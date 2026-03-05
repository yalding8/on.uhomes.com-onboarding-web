# Uhomes OAuth 统一登录接入方案

> 本文档遵循 CLAUDE.md 第 9 节 8 阶段门控流程，当前处于**阶段 1-4（调研 → 评估 → 设计 → 评审）**。

---

## 阶段 1：调研

### 1.1 背景

当前 on.uhomes.com 使用 Supabase Email OTP 作为唯一认证方式。供应商需要输入邮箱、接收验证码、输入验证码三步才能登录。

异乡好居主站（uhomes.com）拥有统一登录系统，支持 OAuth 方式接入。已有 Jobs 站点（jobs.uhomes.com，App ID: 1009）成功接入的先例。

### 1.2 业务目标

- 为已有 uhomes 账号的供应商提供**一键登录**，降低登录门槛
- 打通 uhomes 主站用户体系，复用已有用户的身份信息（姓名、头像、手机号等）
- 保留现有 Supabase OTP 登录作为备选方式

### 1.3 参考文档

- `docs/UHOMES_OAUTH_API.md` — Uhomes OAuth 接口文档（源自 Jobs 站点对接文档）
- `docs/test-oauth.html` — OAuth 登录测试页面

### 1.4 Uhomes OAuth 系统摘要

| 项目         | 值                                                                                |
| ------------ | --------------------------------------------------------------------------------- |
| 认证协议     | 自定义 OAuth（非标准 OAuth 2.0）                                                  |
| 登录跳转     | `GET /buser/api/oauth/goto/{app_name}?redirect=URL`                               |
| 回调方式     | 302 重定向，URL 参数携带 `uhouzz_token` + `access_token`                          |
| 获取用户信息 | `GET /api/oauth/getUserInfo`，Header: `X-Client-Authorization` + `X-Client-Appid` |
| Token 刷新   | `POST /api/oauth/refreshToken`                                                    |
| Token 有效期 | 60 天，每次调用自动续期                                                           |
| 测试环境     | `https://www.pc1.uhomes.com`                                                      |
| 生产环境     | `https://www.uhomes.com`                                                          |
| CSRF 防护    | `state` 参数，5 分钟有效，使用后销毁                                              |

### 1.5 现有认证架构分析

```
当前流程：
用户 → 输入邮箱 → Supabase signInWithOtp → 收邮件 → 输入 OTP → verifyOtp → Session 建立
                                                                                    ↓
                                                                            Middleware 路由
                                                                            ├─ @uhomes.com → BD (auto-provision)
                                                                            └─ 其他 → 按 supplier status 路由
```

```
接入 OAuth 后：
用户 → 选择登录方式 ─┬─ Email OTP → 原有流程不变
                      └─ Uhomes 登录 → 跳转主站 → 回调 → 获取用户信息
                                                            ↓
                                                   服务端创建/关联 Supabase 账号
                                                            ↓
                                                   建立 Supabase Session → Middleware 路由
```

---

## 阶段 2：评估

### 2.1 技术可行性

**核心挑战**：Uhomes OAuth 返回的是自定义 token，而本项目所有鉴权依赖 Supabase Session。需要在 OAuth 回调后将用户映射到 Supabase 账号体系。

**方案**：使用 Supabase Admin API 的 `auth.admin.createUser()` 或 `auth.admin.generateLink()` 在服务端为 OAuth 用户创建/查找 Supabase 账号，并通过 `signInWithPassword` 或自定义 token 建立 Session。

### 2.2 影响范围

| 模块                                              | 影响                                                      | 风险等级 |
| ------------------------------------------------- | --------------------------------------------------------- | -------- |
| 登录页 `src/app/login/page.tsx`                   | 新增「Uhomes 登录」按钮                                   | 低       |
| 中间件 `src/lib/supabase/middleware.ts`           | 无需修改，Session 建立后复用原逻辑                        | 无       |
| 新增 API 路由 `src/app/api/auth/uhomes-callback/` | 处理 OAuth 回调                                           | 中       |
| 新增 API 路由 `src/app/api/auth/uhomes-userinfo/` | 服务端代理获取用户信息                                    | 中       |
| 数据库 `suppliers` 表                             | 可能新增 `uhomes_cust_id` 字段关联主站用户                | 中       |
| 环境变量                                          | 新增 `UHOMES_OAUTH_APP_ID` / `UHOMES_OAUTH_APP_SECRET` 等 | 低       |
| RLS 策略                                          | 无需修改，Session 建立后复用原有策略                      | 无       |

### 2.3 风险评估

| 风险                | 影响                                      | 缓解方案                                           |
| ------------------- | ----------------------------------------- | -------------------------------------------------- |
| Uhomes 登录页不可用 | 用户无法通过 OAuth 登录                   | 保留 Email OTP 作为 fallback                       |
| Token 被截获        | 用户身份被冒用                            | 服务端验证，不在前端暴露 access_token              |
| 用户邮箱不一致      | OAuth 邮箱与已有 Supabase 账号不同        | 以 `uhomes_cust_id` 为主键关联，邮箱冲突时提示用户 |
| 回调域名白名单      | 需要 uhomes 主站侧添加 on.uhomes.com 域名 | 提前申请，否则回调会被拦截                         |

### 2.4 前置条件（需要协调）

1. **申请 App ID + App Secret**：联系 xuqiang.shui@uhomes.com，为 on.uhomes.com 申请独立的 App 配置
2. **回调域名白名单**：将 `on.uhomes.com` 和 `localhost` 加入 Uhomes OAuth 白名单
3. **确认 App Name**：OAuth 跳转路径中的 app name（如 `/goto/onboarding`），需主站侧配置

### 2.5 轨道判定

**Major Track** — 涉及新 API 端点、新数据库字段、安全/认证变更。执行完整 8 阶段流程。

---

## 阶段 3：设计

### 3.1 数据模型变更

```sql
-- 新增 Supabase migration
ALTER TABLE public.suppliers
ADD COLUMN IF NOT EXISTS uhomes_cust_id INTEGER UNIQUE;

COMMENT ON COLUMN public.suppliers.uhomes_cust_id IS 'uhomes.com 主站用户 ID，用于 OAuth 登录关联';

-- 索引
CREATE INDEX IF NOT EXISTS idx_suppliers_uhomes_cust_id
ON public.suppliers(uhomes_cust_id) WHERE uhomes_cust_id IS NOT NULL;
```

### 3.2 用户流程

```
1. 用户访问 /login
2. 点击「使用异乡好居账号登录」按钮
3. 前端重定向到:
   {UHOMES_BASE}/buser/api/oauth/goto/{APP_NAME}?redirect={CALLBACK_URL}
4. 用户在 uhomes 主站完成登录
5. 主站回调到 /api/auth/uhomes-callback?uhouzz_token=xxx&access_token=yyy
6. 服务端:
   a. 调用 /api/oauth/getUserInfo 获取用户信息
   b. 查找 suppliers 表中是否已有 uhomes_cust_id 匹配的记录
   c. 如有 → 找到对应 Supabase user，建立 Session
   d. 如无 → 用 email 查找 Supabase user
      - email 匹配 → 关联 uhomes_cust_id，建立 Session
      - email 不匹配 → 创建新 Supabase user + 初始 supplier 记录
   e. 302 重定向到 /dashboard 或 /admin（根据角色）
```

### 3.3 新增 API 路由

#### `GET /api/auth/uhomes-login`

发起 OAuth 登录跳转。

```
请求: GET /api/auth/uhomes-login
鉴权: 公开
响应: 302 → {UHOMES_BASE}/buser/api/oauth/goto/{APP_NAME}?redirect=...
```

#### `GET /api/auth/uhomes-callback`

处理 OAuth 回调。

```
请求: GET /api/auth/uhomes-callback?uhouzz_token=xxx&access_token=yyy
鉴权: 公开（但验证 token 有效性）
响应:
  - 成功: 302 → /dashboard 或 /admin
  - 失败: 302 → /login?error=oauth_failed
```

### 3.4 新增环境变量

| 变量名                    | 说明                  | 示例值                   |
| ------------------------- | --------------------- | ------------------------ |
| `UHOMES_OAUTH_BASE_URL`   | Uhomes OAuth 基础域名 | `https://www.uhomes.com` |
| `UHOMES_OAUTH_APP_ID`     | 应用 ID（需申请）     | `TBD`                    |
| `UHOMES_OAUTH_APP_SECRET` | 应用密钥（需申请）    | `TBD`                    |
| `UHOMES_OAUTH_APP_NAME`   | OAuth 路径中的应用名  | `onboarding`             |

### 3.5 安全设计

1. **服务端代理**：采用方案 3（服务端调用），access_token 不暴露给前端
2. **CSRF 防护**：生成 state 参数存入 HttpOnly Cookie，回调时验证
3. **Token 存储**：access_token 仅在服务端内存中短暂使用，不持久化
4. **邮箱冲突处理**：如果 OAuth 返回的邮箱已被其他 Supabase 用户占用，提示用户用原邮箱 OTP 登录后关联

### 3.6 文件结构

```
src/
├── app/
│   ├── api/auth/
│   │   ├── uhomes-login/route.ts      # 发起 OAuth 跳转
│   │   └── uhomes-callback/route.ts   # 处理 OAuth 回调
│   └── login/page.tsx                 # 修改：新增 OAuth 登录按钮
├── lib/
│   └── oauth/
│       ├── uhomes-client.ts           # Uhomes OAuth 客户端封装
│       ├── types.ts                   # OAuth 相关类型定义
│       └── __tests__/
│           └── uhomes-client.test.ts  # 单元测试
```

---

## 阶段 4：评审

### 自查清单

- [x] 方案覆盖了国际化场景 — Uhomes 主站本身支持多语言，OAuth 流程语言无关
- [x] 数据模型变更有向后兼容策略 — `uhomes_cust_id` 为可选字段，不影响现有记录
- [x] 新增 API 有 Rate Limiting 设计 — 复用现有 `rate-limit.ts`
- [x] 涉及个人数据的功能有合规设计 — 仅存储 cust_id，不存储主站密码/Token
- [x] 错误路径有监控 — OAuth 失败通过 Sentry 上报
- [x] 新增页面有完整状态设计 — 登录按钮有 loading/disabled/error 状态
- [x] 方案文档已更新到 docs/ 目录 — 本文件

### 前置依赖（阻塞项）

> **以下事项必须在进入阶段 5（编写测试用例）之前完成：**

1. [ ] 向 Uhomes 主站申请 on.uhomes.com 专属 App ID + App Secret
2. [ ] 确认 OAuth 跳转路径中的 App Name
3. [ ] 将 `on.uhomes.com` + `localhost:3000` 加入回调域名白名单

---

## 阶段 5：测试用例设计（先行）

> 在编码前，先确定「测什么」。

### 5.1 测试矩阵

#### Unit Tests — `src/lib/oauth/__tests__/uhomes-client.test.ts`

| #   | 测试场景                     | 类型 | 说明                                           |
| --- | ---------------------------- | ---- | ---------------------------------------------- |
| U1  | 构造正确的 OAuth 跳转 URL    | 正常 | 验证 redirect 参数编码、base URL 拼接          |
| U2  | 解析回调参数                 | 正常 | 从 URL 中正确提取 uhouzz_token 和 access_token |
| U3  | 缺少 access_token 时抛错     | 异常 | 回调 URL 缺少必要参数                          |
| U4  | 缺少 uhouzz_token 时抛错     | 异常 | 回调 URL 缺少必要参数                          |
| U5  | getUserInfo 正常返回         | 正常 | mock fetch，验证 Header 拼装和响应解析         |
| U6  | getUserInfo 返回错误码 1002  | 异常 | token 过期场景                                 |
| U7  | getUserInfo 返回错误码 1003  | 异常 | 用户不存在场景                                 |
| U8  | getUserInfo 网络超时         | 异常 | fetch 超时处理                                 |
| U9  | refreshToken 正常返回        | 正常 | 验证新 token 正确解析                          |
| U10 | refreshToken 返回错误码 2002 | 异常 | token 已失效需重新登录                         |

#### Integration Tests — `src/app/api/auth/__tests__/`

| #   | 测试场景                                         | 类型 | 说明                                                          |
| --- | ------------------------------------------------ | ---- | ------------------------------------------------------------- |
| I1  | uhomes-login 路由生成正确的重定向 URL            | 正常 | 验证 302 响应和 Location header                               |
| I2  | uhomes-callback 完整流程（新用户）               | 正常 | mock Uhomes API → 创建 Supabase 用户 → 创建 supplier → 重定向 |
| I3  | uhomes-callback 完整流程（已有 uhomes_cust_id）  | 正常 | 直接找到用户，建立 Session                                    |
| I4  | uhomes-callback 邮箱匹配已有用户                 | 正常 | 无 uhomes_cust_id 但邮箱匹配，关联并登录                      |
| I5  | uhomes-callback access_token 无效                | 异常 | Uhomes API 返回 1002，重定向到 /login?error=token_invalid     |
| I6  | uhomes-callback 缺少参数                         | 异常 | 无 access_token，重定向到 /login?error=missing_params         |
| I7  | uhomes-callback Uhomes API 不可用                | 异常 | fetch 失败，重定向到 /login?error=service_unavailable         |
| I8  | uhomes-callback @uhomes.com 邮箱自动分配 BD 角色 | 边界 | OAuth 登录的 @uhomes.com 用户应自动成为 BD                    |

#### E2E Tests（手动测试清单，需获取真实 App 配置后执行）

| #   | 测试场景                     | 预期结果                     |
| --- | ---------------------------- | ---------------------------- |
| E1  | 新用户通过 OAuth 首次登录    | 创建账号，跳转到 /dashboard  |
| E2  | 已有供应商通过 OAuth 登录    | 直接跳转到 /dashboard        |
| E3  | BD 用户通过 OAuth 登录       | 跳转到 /admin                |
| E4  | OAuth 登录后切换为 OTP 登录  | 同一账号，两种方式都可登录   |
| E5  | 在 Uhomes 主站未登录状态测试 | 跳转到主站登录页，完成后回调 |
| E6  | 在 Uhomes 主站已登录状态测试 | 直接回调，无需再次输入密码   |

---

## 阶段 6-8：待前置依赖完成后执行

阶段 6（开发）、阶段 7（测试）、阶段 8（评审验收）将在获取 App ID 和回调白名单配置后启动。

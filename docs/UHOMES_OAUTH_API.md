# Jobs 站点 OAuth 接入文档

## 概述

本文档描述 Jobs 站点（https://jobs.uhomes.com）接入 Uhomes 统一登录系统的对接方式。

**App ID**: `1009`
**App Secret**: `xxxxxxx`

**基础域名**:

- 生产环境: `https://www.uhomes.com`
- 测试环境: `https://www.pc1.uhomes.com`

> **注意**: App Secret 仅用于服务端验证，请勿在前端代码中暴露。

---

## 登录流程图

```
┌─────────────┐
│ Jobs 站点   │
│ (未登录)    │
└──────┬──────┘
       │ 1. 用户点击登录
       │
       ▼
┌─────────────────────────────────────┐
│ 跳转到 Uhomes 登录跳转接口          │
│ /buser/api/oauth/goto/jobs          │
│ ?redirect=http://jobs.uhomes.com/test-oauth.html
└──────┬──────────────────────────────┘
       │
       │ 2. 检查用户登录状态
       │
       ├─ 已登录 ──────────────────────┐
       │                                │
       │ 3a. 直接生成 token             │
       │     跳转回 Jobs 站点           │
       │                                │
       └─ 未登录 ──────────────────────┤
                                        │
       ┌────────────────────────────────┘
       │ 3b. 跳转到 Uhomes 登录页面
       │     https://www.pc3.uhomes.com/users/login
       │     (测试环境)
       ▼
┌─────────────────────────────────────┐
│ Uhomes 登录页面                     │
│ 用户输入账号密码                    │
└──────┬──────────────────────────────┘
       │
       │ 4. 登录成功
       │
       ▼
┌─────────────────────────────────────┐
│ 前端跳转到回调接口                  │
│ /buser/api/oauth/callback/jobs      │
│ ?state=xxx&uhouzz_token=yyy         │
└──────┬──────────────────────────────┘
       │
       │ 5. 验证 token，生成 access_token
       │
       ▼
┌─────────────────────────────────────┐
│ 回调到 Jobs 站点                    │
│ ?uhouzz_token=xxx&access_token=yyy  │
└──────┬──────────────────────────────┘
       │
       │ 6. 获取用户信息
       │
       ▼
┌─────────────────────────────────────┐
│ 调用 /api/oauth/getUserInfo         │
└──────┬──────────────────────────────┘
       │ 7. 返回用户信息
       │
       ▼
┌─────────────────────────────────────┐
│ Jobs 创建/关联本地账号              │
│ 完成登录                            │
└─────────────────────────────────────┘
```

---

## 接口列表

### 1. 登录跳转接口

**接口描述**: Jobs 站点跳转到 Uhomes 登录页面

**请求方式**: `GET`

**请求 URL**:

```
{BASE_DOMAIN}/buser/api/oauth/goto/jobs
```

**请求参数**:

| 参数名   | 类型   | 必填 | 说明                                                |
| -------- | ------ | ---- | --------------------------------------------------- |
| redirect | String | 是   | 登录成功后的回调地址，必须是 jobs.uhomes.com 域名下 |
| domain   | String | 否   | 域名（预留参数）                                    |
| reurl    | String | 否   | 返回URL（预留参数）                                 |

**示例请求**:

```http
GET https://www.uhomes.com/buser/api/oauth/goto/jobs?redirect=https://jobs.uhomes.com/auth/callback
```

**响应**: 302 重定向到 Uhomes 登录页面

---

### 2. 登录回调接口

**接口描述**: Uhomes 登录成功后，携带 token 回调到 Jobs 站点

**请求方式**: `GET` (自动重定向)

**请求 URL**: 由 Jobs 站点在第一步提供的 `redirect` 参数决定

**回调参数**:

| 参数名       | 类型   | 必填 | 说明                                             |
| ------------ | ------ | ---- | ------------------------------------------------ |
| state        | String | 是   | OAuth state 参数，用于防 CSRF 攻击               |
| uhouzz_token | String | 否   | Uhomes 系统令牌（可从 URL 参数或 Cookie 中获取） |
| access_token | String | 否   | Jobs 站点专用令牌（app_id=1009）                 |

**说明**:

- 如果 URL 参数中没有 `uhouzz_token`，系统会自动从 Cookie 中读取
- 登录成功后，Uhomes 会将 `uhouzz_token` 写入 Cookie
- 前端只需跳转到回调 URL，无需手动传递 token 参数

**示例回调 URL**:

```
https://www.pc1.uhomes.com/buser/api/oauth/callback/jobs?state=xxx
```

或

```
https://www.pc1.uhomes.com/buser/api/oauth/callback/jobs?state=xxx&uhouzz_token=yyy&access_token=zzz
```

---

### 3. 获取用户信息接口

**接口描述**: 根据 token 获取用户信息

**请求方式**: `GET`

**请求 URL**:

```
{BASE_DOMAIN}/api/oauth/getUserInfo
```

**Headers** (必填):

```
X-Client-Authorization: Bearer YOUR_ACCESS_TOKEN
X-Client-Appid: 1009
```

**Header 说明**:

| Header                 | 类型   | 必填 | 说明                        |
| ---------------------- | ------ | ---- | --------------------------- |
| X-Client-Authorization | String | 是   | Bearer token 格式的访问令牌 |
| X-Client-Appid         | Int    | 是   | 应用ID（Jobs站点使用 1009） |

**成功响应**:

```json
200{
    "error_code": 0,
    "message": "success",
    "data": {
        "cust_id": 12345,
        "phone": "+8613800138000",
        "country_code": "86",
        "email": "user@example.com",
        "nickname": "张三",
        "realname": "张三",
        "avatar": "https://cdn.uhomes.com/avatar/xxx.jpg",
        "identity": 1,
        "is_phone_confirmed": 1,
        "is_email_confirmed": 1,
        "gender": 0,
        "birthday": "1990-01-01"
    }
}
```

**字段说明**:

| 字段名             | 类型   | 说明                                          |
| ------------------ | ------ | --------------------------------------------- |
| cust_id            | Int    | 用户 ID                                       |
| phone              | String | 手机号                                        |
| country_code       | String | 国家码                                        |
| email              | String | 邮箱                                          |
| nickname           | String | 昵称                                          |
| realname           | String | 真实姓名                                      |
| avatar             | String | 头像 URL                                      |
| identity           | Int    | 用户身份 (1:普通用户, 2:房东, 3:顾问, 4:公寓) |
| is_phone_confirmed | Int    | 手机是否已验证 (0:否, 1:是)                   |
| is_email_confirmed | Int    | 邮箱是否已验证 (0:否, 1:是)                   |
| gender             | Int    | 性别 (0:未知, 1:男, 2:女)                     |
| birthday           | String | 生日                                          |

**错误响应**:

```json
{
  "error_code": 1001,
  "message": "X-Client-Authorization header 不能为空"
}
```

**错误码说明**:

| 错误码 | 说明                                                            |
| ------ | --------------------------------------------------------------- |
| 1001   | X-Client-Authorization header 或 X-Client-Appid header 不能为空 |
| 1002   | token 无效或已过期                                              |
| 1003   | 用户不存在                                                      |
| 5000   | 服务器错误                                                      |

---

### 4. 刷新 Token 接口

**接口描述**: 刷新 access_token，延长有效期

**请求方式**: `POST`

**请求 URL**:

```
{BASE_DOMAIN}/api/oauth/refreshToken
```

**Headers** (必填):

```
X-Client-Authorization: Bearer YOUR_ACCESS_TOKEN
X-Client-Appid: 1009
Content-Type: application/x-www-form-urlencoded
```

**Header 说明**:

| Header                 | 类型   | 必填 | 说明                        |
| ---------------------- | ------ | ---- | --------------------------- |
| X-Client-Authorization | String | 是   | Bearer token 格式的访问令牌 |
| X-Client-Appid         | Int    | 是   | 应用ID（Jobs站点使用 1009） |
| Content-Type           | String | 是   | 请求内容类型                |

**成功响应**:

```json
{
  "error_code": 0,
  "message": "success",
  "data": {
    "access_token": "new_access_token_value"
  }
}
```

**错误响应**:

```json
{
  "error_code": 2002,
  "message": "token无效或已过期，请重新登录"
}
```

**错误码说明**:

| 错误码 | 说明                                                            |
| ------ | --------------------------------------------------------------- |
| 2001   | X-Client-Authorization header 或 X-Client-Appid header 不能为空 |
| 2002   | token 无效或已过期，请重新登录                                  |
| 5000   | 服务器错误                                                      |

---

## Token 机制

### Token 类型

1. **access_token**: 特定于 app_id=1009 的令牌，仅 Jobs 站点可用
2. **uhouzz_token**: Uhomes 系统通用令牌，跨应用共享

### 有效期

- **默认有效期**: 60 天（5184000 秒）
- **自动续期**: 只要 token 未过期且被调用，有效期从调用时间起延长 60 天

### Token 过期处理

当 token 过期时：

1. 返回错误码 `1002`（获取用户信息时）或 `2002`（刷新 token 时）
2. Jobs 站点应引导用户重新登录

---

## 安全说明

### 1. 回调地址白名单

为确保安全，仅允许以下域名的回调地址：

- `jobs.uhomes.com`
- `test-jobs.uhomes.com`
- `localhost`（仅开发环境）

### 2. CSRF 防护

登录跳转时使用 `state` 参数进行 CSRF 防护：

1. 生成随机 state 并存储到 Redis（降级到 session）
2. 回调时验证 state 有效性
3. state 有效期为 5 分钟
4. state 使用后立即删除，防止重放攻击

**技术实现**：

- 优先使用 Redis 存储 state，确保在负载均衡环境下可用
- 如果 Redis 不可用，降级使用 session
- 使用 `oauth_jobs_state_{state}` 作为缓存键

### 3. Token 传输

- 所有 token 均通过 HTTPS 传输
- 使用 Authorization Header 传递 token（Bearer Token 标准方式）
- Jobs 站点应将 token 安全存储（HttpOnly Cookie 或 LocalStorage）

### 4. 跨域请求（CORS）支持

由于 Jobs 站点（`https://jobs.uhomes.com`）和 API 域名（`https://www.uhomes.com`）不同，前端直接调用 API 会遇到跨域问题。

#### 已支持的跨域域名

以下接口已配置 CORS 支持：

- `/api/oauth/getUserInfo`
- `/api/oauth/refreshToken`

允许的域名白名单：

- `https://jobs.uhomes.com`（生产环境）
- `https://test-jobs.uhomes.com`（测试环境）
- `http://localhost` 及其子域名（开发环境）

**注意**：CORS 配置需要在 Nginx 层面添加，详细配置请参考：

- 完整配置文档：[docs/nginx-cors-config.md](nginx-cors-config.md)
- 运维工单模板：[docs/ops-cors-request.md](ops-cors-request.md)

#### 跨域解决方案对比

**方案 1：使用 CORS（当前方案）**

前端直接调用 API，服务端返回 CORS 响应头。

```javascript
// 前端代码示例
fetch("https://www.uhomes.com/api/oauth/getUserInfo", {
  headers: {
    "X-Client-Authorization": "Bearer YOUR_TOKEN",
    "X-Client-Appid": "1009",
  },
});
```

优点：

- 简单直接，无需额外配置
- 已经实现，开箱即用

缺点：

- Token 暴露在前端
- 需要维护域名白名单

---

**方案 2：使用反向代理（推荐生产环境）**

在 Jobs 站点的 Nginx 配置反向代理，前端请求同域名下的 API。

Nginx 配置示例：

```nginx
# Jobs 站点 Nginx 配置
server {
    listen 443 ssl;
    server_name jobs.uhomes.com;

    # 前端静态资源
    location / {
        root /var/www/jobs;
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理
    location /api/ {
        proxy_pass https://www.uhomes.com/api/;
        proxy_set_header Host www.uhomes.com;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

前端代码：

```javascript
// 前端请求同域名，不会有跨域问题
fetch("/api/oauth/getUserInfo", {
  headers: {
    "X-Client-Authorization": "Bearer YOUR_TOKEN",
    "X-Client-Appid": "1009",
  },
});
```

优点：

- 不会有跨域问题
- 更安全（不暴露真实 API 地址）
- 可以统一管理请求
- 可以添加额外的安全策略

缺点：

- 需要配置 Nginx
- 增加了一层代理

---

**方案 3：服务端调用（最安全）**

Jobs 站点通过自己的后端服务调用 Uhomes API，前端只调用 Jobs 后端。

架构：

```
前端 → Jobs 后端 → Uhomes API
```

Jobs 后端代码示例（Node.js）：

```javascript
// Jobs 后端接口
app.get("/api/user/info", async (req, res) => {
  const accessToken = req.headers.authorization.replace("Bearer ", "");

  // 调用 Uhomes API
  const response = await fetch("https://www.uhomes.com/api/oauth/getUserInfo", {
    headers: {
      "X-Client-Authorization": `Bearer ${accessToken}`,
      "X-Client-Appid": "1009",
    },
  });

  const data = await response.json();
  res.json(data);
});
```

前端代码：

```javascript
// 前端调用 Jobs 自己的后端
fetch("/api/user/info", {
  headers: {
    "X-Client-Authorization": `Bearer ${accessToken}`,
  },
});
```

优点：

- 最安全（Token 不暴露在前端）
- 不会有跨域问题
- 可以添加额外的业务逻辑
- 可以缓存用户信息

缺点：

- 需要开发 Jobs 后端接口
- 增加了开发工作量
- 增加了一层服务调用

---

#### 方案选择建议

| 场景                   | 推荐方案             | 说明                   |
| ---------------------- | -------------------- | ---------------------- |
| 快速开发/测试          | 方案 1（CORS）       | 无需额外配置，快速上线 |
| 生产环境（纯前端项目） | 方案 2（反向代理）   | 安全性更高，配置简单   |
| 生产环境（有后端服务） | 方案 3（服务端调用） | 最安全，可扩展性强     |

---

## 前端对接示例

### 1. 发起登录请求

```javascript
// Jobs 站点登录按钮点击处理
function handleLogin() {
  // 生成回调地址
  const redirectUri = encodeURIComponent(
    "https://jobs.uhomes.com/auth/callback",
  );

  // 跳转到 Uhomes 登录
  window.location.href = `https://www.uhomes.com/buser/api/oauth/goto/jobs?redirect=${redirectUri}`;
}
```

### 2. 处理登录回调

```javascript
// Jobs 站点回调页面
async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const uhouzzToken = params.get("uhouzz_token");
  const accessToken = params.get("access_token");

  if (!uhouzzToken || !accessToken) {
    // 登录失败，返回登录页
    window.location.href = "/login";
    return;
  }

  try {
    // 获取用户信息（使用 Authorization Header 传递 token）
    const response = await fetch(
      "https://www.uhomes.com/api/oauth/getUserInfo",
      {
        headers: {
          "X-Client-Authorization": `Bearer ${accessToken}`,
          "X-Client-Appid": "1009",
        },
      },
    );

    const result = await response.json();

    if (result.error_code === 0) {
      // 保存 token
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("uhouzz_token", uhouzzToken);

      // 保存用户信息
      localStorage.setItem("user_info", JSON.stringify(result.data));

      // 创建/关联本地账号
      await createOrUpdateLocalAccount(result.data);

      // 跳转到首页
      window.location.href = "/";
    } else {
      // 处理错误
      showError(result.message);
    }
  } catch (error) {
    console.error("获取用户信息失败:", error);
    showError("获取用户信息失败");
  }
}
```

### 3. 刷新 Token

```javascript
async function refreshToken() {
  const accessToken = localStorage.getItem("access_token");

  if (!accessToken) {
    // 需要重新登录
    handleLogin();
    return;
  }

  try {
    const response = await fetch(
      "https://www.uhomes.com/api/oauth/refreshToken",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Client-Authorization": `Bearer ${accessToken}`,
          "X-Client-Appid": "1009",
        },
      },
    );
    const result = await response.json();

    if (result.error_code === 0) {
      // 更新前端 token
      const newToken = result.data.access_token;
      localStorage.setItem("access_token", newToken);

      // 重新发送原请求
      originalRequest.headers["X-Client-Authorization"] = `Bearer ${newToken}`;
      return axios(originalRequest);
    } else {
      // Token 已失效，需要重新登录
      handleLogin();
    }
  } catch (error) {
    console.error("刷新 Token 失败:", error);
  }
}
```

### 4. 使用反向代理的前端示例

如果使用方案 2（反向代理），前端代码更简单：

```javascript
// 获取用户信息（通过反向代理，无跨域问题）
async function getUserInfo(accessToken) {
  const response = await fetch("/api/oauth/getUserInfo", {
    headers: {
      "X-Client-Authorization": `Bearer ${accessToken}`,
      "X-Client-Appid": "1009",
    },
  });
  return await response.json();
}

// 刷新 Token
async function refreshToken(accessToken) {
  const response = await fetch("/api/oauth/refreshToken", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Client-Authorization": `Bearer ${accessToken}`,
      "X-Client-Appid": "1009",
    },
  });
  return await response.json();
}
```

---

## 测试步骤

### 1. 测试登录跳转

访问以下 URL：

```
https://www.pc1.uhomes.com/buser/api/oauth/goto/jobs?redirect=http://localhost.buser.com:8888/test-oauth.html
```

**预期行为**：

- 如果已登录：直接跳转回测试页面，URL 中携带 `uhouzz_token` 和 `access_token`
- 如果未登录：跳转到 `https://www.pc3.uhomes.com/users/login`，需要输入账号密码登录

### 2. 完成登录

在 Uhomes 登录页面输入账号密码，登录成功后：

- 前端会自动跳转到回调接口：`/buser/api/oauth/callback/jobs?state=xxx&uhouzz_token=yyy`
- 回调接口验证成功后，会跳转回测试页面，URL 中携带 `uhouzz_token` 和 `access_token`

### 3. 测试获取用户信息

使用登录后获得的 `access_token` 调用以下接口：

```bash
curl -X GET "https://www.pc1.uhomes.com/api/oauth/getUserInfo" \
  -H "X-Client-Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "X-Client-Appid: 1009"
```

### 4. 测试 Token 刷新

```bash
curl -X POST "https://www.pc1.uhomes.com/api/oauth/refreshToken" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "X-Client-Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "X-Client-Appid: 1009"
```

---

## 注意事项

1. **HTTPS 强制**: 所有接口必须通过 HTTPS 调用
2. **域名验证**: 回调地址必须在白名单域名内
3. **Token 传递**: token 必须通过 X-Client-Authorization Header (Bearer) 传递
4. **App ID**: 请求头中必须包含 `X-Client-Appid`
5. **Token 续期**: 每次成功调用获取用户信息接口会自动续期 60 天
6. **错误处理**: 请正确处理所有错误码，特别是 token 过期的情况
7. **登录页面配置**:
   - 测试环境登录页面：`https://www.pc3.uhomes.com/users/login`
   - 生产环境登录页面：`https://www.uhomes.com/users/login`
   - 登录成功后，前端需要跳转到 `redirect` 参数指定的回调地址
8. **已登录用户**: 如果用户已在 Uhomes 登录（有 `uhouzz_token` cookie），会直接回调，无需再次登录

## 联系方式

如有问题请联系：

- 技术支持邮箱: xuqiang.shui@uhomes.com
- 项目仓库: (内部地址)

---

## 接口快速参考

| 功能         | URL                          | 方法 | 说明                          |
| ------------ | ---------------------------- | ---- | ----------------------------- |
| 登录跳转     | `/buser/api/oauth/goto/jobs` | GET  | Jobs 站点跳转到 Uhomes 登录页 |
| 登录回调     | `/buser/api/callback/jobs`   | GET  | Jobs 站点登录回调             |
| 获取用户信息 | `/api/oauth/getUserInfo`     | GET  | 根据 token 获取用户信息       |
| 刷新 Token   | `/api/oauth/refreshToken`    | POST | 刷新 access_token             |

---

## 下载文件列表

| 文件                                                 | 说明            |
| ---------------------------------------------------- | --------------- |
| [Oauth.php](../apps/api/controller/)                 | OAuth 控制器    |
| [CustomerToken.php](../apps/common/model/)           | Token 模型      |
| [UhouzzCustomer.php](../apps/common/model/)          | Uhouzz 令牌模型 |
| [route.php](../configs/route.php)                    | 路由配置        |
| [CheckClientSignature.php](../apps/common/behavior/) | 客户端签名验证  |

---

**生产环境接口**:

- 基础域名: `https://www.uhomes.com`

**测试环境接口**:

- 基础域名: `https://www.pc1.uhomes.com`

---

**App 配置信息**:

- App ID: 1009
- App Secret: `HUT6q8IkbdquS45F`

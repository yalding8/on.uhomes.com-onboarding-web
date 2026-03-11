# 开发计划：三项审计遗留修复

**日期**: 2026-03-11
**来源**: S1 审计二次核实后收窄的真实待办
**关联文档**: `docs/AUDIT_2026-03-11_S1_SECURITY.md`, `docs/EXPERT_REVIEW_TEST_STRATEGY.md`

---

## 任务总览

| #   | 任务                                          | 轨道     | 优先级 | 预计改动文件数       |
| --- | --------------------------------------------- | -------- | ------ | -------------------- |
| T1  | `executeDeletion` + `approve-supplier` 事务化 | Standard | P0     | 4 文件 + 1 migration |
| T2  | `building-images` bucket 清理补全             | Hotfix   | P1     | 1 文件               |
| T3  | DocuSign 过期合同 UI 展示 + 通知              | Standard | P2     | 5 文件 + 1 新模板    |

建议执行顺序：T2 → T1 → T3（先完成简单修复，再处理事务化核心问题，最后做 UI 增强）

---

## T1: 多步操作事务化（Standard Track）

### 问题

`executeDeletion` 和 `approve-supplier` 均为顺序 Supabase 调用，无 DB 事务。中途失败会导致：

- 删除流程：部分数据已删、部分残留，违反 GDPR
- 审批流程：Auth 用户/供应商/合同部分创建，产生孤立记录（虽有手动 rollback 但非原子）

### 方案

项目目前无 `supabase.rpc()` 使用先例，但已有 5 个 PostgreSQL 函数（trigger/RLS helper）。采用 **Supabase RPC + PostgreSQL 函数** 将关键操作包装为事务。

#### T1-A: `approve-supplier` 事务化

**新建 migration**: `supabase/migrations/2026MMDD_approve_supplier_tx.sql`

```sql
CREATE OR REPLACE FUNCTION approve_supplier_tx(
  p_application_id UUID,
  p_user_id UUID,
  p_supplier_data JSONB,
  p_contract_data JSONB
) RETURNS JSONB AS $$
DECLARE
  v_supplier_id UUID;
  v_contract_id UUID;
BEGIN
  -- 1. 创建 supplier 记录
  INSERT INTO suppliers (...) VALUES (...)
  RETURNING id INTO v_supplier_id;

  -- 2. 创建 contract 记录
  INSERT INTO contracts (...) VALUES (...)
  RETURNING id INTO v_contract_id;

  -- 3. 标记 application 为 CONVERTED
  UPDATE applications SET status = 'CONVERTED' WHERE id = p_application_id;

  RETURN jsonb_build_object('supplier_id', v_supplier_id, 'contract_id', v_contract_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**修改文件**: `src/app/api/admin/approve-supplier/route.ts`

- Auth 用户创建仍在应用层（Supabase Auth API 无法纳入 DB 事务）
- 原子 claim（PENDING → CONVERTING）保留在应用层（已有效）
- 将 supplier 创建 + contract 创建 + application CONVERTED 三步合并为 `supabase.rpc('approve_supplier_tx', {...})`
- 失败时只需回滚 Auth 用户（单一操作），不再需要多步手动 rollback

**改动范围**:
| 文件 | 改动 |
|------|------|
| `supabase/migrations/2026MMDD_approve_supplier_tx.sql` | 新建 |
| `src/app/api/admin/approve-supplier/route.ts` | 重构核心逻辑，调用 RPC |

#### T1-B: `executeDeletion` 事务化

**新建 migration**: `supabase/migrations/2026MMDD_delete_supplier_tx.sql`

```sql
CREATE OR REPLACE FUNCTION delete_supplier_tx(
  p_supplier_id UUID,
  p_contact_email TEXT,
  p_is_australia BOOLEAN
) RETURNS VOID AS $$
BEGIN
  -- 删除关联数据（按依赖顺序）
  DELETE FROM supplier_notes WHERE supplier_id = p_supplier_id;
  DELETE FROM supplier_badges WHERE supplier_id = p_supplier_id;
  DELETE FROM building_images WHERE building_id IN (
    SELECT id FROM buildings WHERE supplier_id = p_supplier_id
  );
  DELETE FROM buildings WHERE supplier_id = p_supplier_id;

  -- 获取 application IDs
  -- 删除 application_notes + applications

  IF p_is_australia THEN
    -- 匿名化路径
    UPDATE suppliers SET ... WHERE id = p_supplier_id;
    UPDATE contracts SET document_url = NULL, signature_fields = NULL
      WHERE supplier_id = p_supplier_id;
  ELSE
    -- GDPR 完全删除路径
    DELETE FROM suppliers WHERE id = p_supplier_id;
    UPDATE contracts SET document_url = NULL, signature_fields = NULL
      WHERE supplier_id = p_supplier_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**修改文件**: `src/lib/compliance/account-deletion.ts`

- Storage 清理保留在应用层（Storage API 非 DB 操作）
- DB 操作统一调用 `supabase.rpc('delete_supplier_tx', {...})`
- Auth 用户删除保留在应用层（最后一步）
- 执行顺序变为：Storage 清理 → DB 事务（RPC）→ Auth 删除

**改动范围**:
| 文件 | 改动 |
|------|------|
| `supabase/migrations/2026MMDD_delete_supplier_tx.sql` | 新建 |
| `src/lib/compliance/account-deletion.ts` | 重构，DB 操作改为 RPC 调用 |

### 测试要点

- 模拟 RPC 中途失败，验证事务回滚（无残留数据）
- approve-supplier: Auth 创建成功但 RPC 失败 → Auth 用户被清理
- executeDeletion: Storage 清理成功但 RPC 失败 → 只有 Storage 文件丢失（可接受，优于数据不一致）
- 现有测试回归通过

---

## T2: building-images bucket 清理补全（Hotfix Track）

### 问题

`executeDeletion` 清理了 `signed-contracts` 和 `uploaded-contracts` 两个 bucket，但遗漏了 `building-images` bucket。删除供应商后，楼宇图片文件成为孤立数据。

### 方案

在 `src/lib/compliance/account-deletion.ts` 的 `storageBuckets` 数组中增加 `"building-images"`。

**当前代码**:

```typescript
const storageBuckets = ["signed-contracts", "uploaded-contracts"];
```

**修改为**:

```typescript
const storageBuckets = [
  "signed-contracts",
  "uploaded-contracts",
  "building-images",
];
```

**注意**: building-images 的文件路径模式需确认。当前两个 bucket 使用 `${supplierId}/` 前缀，需验证 building-images bucket 是否也使用相同模式（从 `src/app/api/buildings/[buildingId]/images/route.ts` 看，路径可能是 `${buildingId}/`，需要先查询该供应商的所有 building ID 再逐个清理）。

**改动范围**:
| 文件 | 改动 |
|------|------|
| `src/lib/compliance/account-deletion.ts` | 增加 building-images 清理逻辑 |

### 测试要点

- 验证 building-images 文件路径模式
- 删除包含多栋楼宇（含图片）的供应商，确认 Storage 无残留

---

## T3: DocuSign 过期合同 UI 展示 + 通知（Standard Track）

### 现状

`cron/cleanup` 每天检测 SENT > 30 天的合同，在 `provider_metadata` 中写入 `signing_expired: true`，但该标记是**只写不读**的——全站无任何地方消费它。

### 方案

#### T3-A: 供应商端 UI 展示过期状态

**文件**: `src/components/signing/ContractStatusContent.tsx`

在 SENT 状态分支中，检查 `provider_metadata.signing_expired`：

- 未过期：保持现状（"Signing Email Sent — Check Your Inbox"）
- 已过期：显示警告样式 + 提示文案（"Your signing link has expired. Please contact your account manager to resend."）+ 保留 Resend 按钮

#### T3-B: 管理端 UI 展示过期状态

**文件 1**: `src/app/admin/suppliers/[id]/page.tsx`

- 合同状态 badge 旁增加过期警告标签（读取已 fetch 的 `provider_metadata`）

**文件 2**: `src/app/api/admin/suppliers/[supplierId]/timeline/route.ts`

- `buildContractSent()` 中检查 `provider_metadata.signing_expired`，过期时 milestone 显示为 `in_progress` + 带过期日期

**文件 3**: `src/app/admin/contracts/[contractId]/edit/page.tsx`

- SENT 状态提示中追加过期信息

#### T3-C: 重发后清除过期标记

**文件**: `src/lib/contracts/confirm-handlers.ts`

- 重发合同成功后，清除 `provider_metadata` 中的 `signing_expired`/`expired_at` 字段，避免新信封仍显示过期

#### T3-D: 过期邮件通知（可选，视需求决定）

**新建文件**: `src/lib/email/templates/contract-expired.ts`

- 通知 BD 管理员：某供应商的签约链接已过期，需要重新发送

**修改文件**: `src/app/api/cron/cleanup/route.ts`

- 标记过期后，触发邮件通知（仅首次标记时发送，通过检查 `signing_expired` 是否已存在来去重）

**改动范围**:
| 文件 | 改动 |
|------|------|
| `src/components/signing/ContractStatusContent.tsx` | 增加过期状态 UI |
| `src/app/admin/suppliers/[id]/page.tsx` | 增加过期警告标签 |
| `src/app/api/admin/suppliers/[supplierId]/timeline/route.ts` | timeline 过期状态 |
| `src/app/admin/contracts/[contractId]/edit/page.tsx` | 编辑页过期提示 |
| `src/lib/contracts/confirm-handlers.ts` | 重发后清除过期标记 |
| `src/lib/email/templates/contract-expired.ts` | 新建（可选） |
| `src/app/api/cron/cleanup/route.ts` | 触发通知（可选） |

### 测试要点

- SENT 合同超过 30 天 → 供应商/管理端均显示过期警告
- BD 重发合同 → 过期标记被清除，UI 恢复正常
- 邮件通知仅首次过期时发送，不重复

---

## 上线清单（通用）

- [ ] `npx prettier --write .`
- [ ] `npx tsc --noEmit` 无错误
- [ ] `bash scripts/check-file-lines.sh` 行数检查通过
- [ ] `npx vitest run` 全部通过
- [ ] 新增 migration 已记录到 `memory/manual-actions.md`
- [ ] RPC 函数已在 Supabase 中执行
- [ ] push 后确认 Vercel 部署成功

# External Expert Review: Test Strategy Assessment

> Reviewer: External QA Strategy Expert (15+ years, SaaS/compliance/concurrency specialization)
> Date: 2026-03-08
> Scope: Review of 100-supplier simulation QA approach + test strategy recommendations

---

## 1. Critical Gaps Identified

### Critical Severity

| #   | Gap                                                                                                                                                                                                        | Impact                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | **No transaction boundaries on multi-step mutations** — `executeDeletion` performs 5 sequential Supabase calls with no transaction. If step 3 fails, steps 1-2 are committed. Same for `approve-supplier`. | Partial deletion violates GDPR; partial approval creates orphaned records |
| 2   | **Auth user not deleted during account deletion** — `executeDeletion` deletes supplier record but never calls `adminClient.auth.admin.deleteUser(userId)`                                                  | Supabase Auth user persists after "deletion", violating Right to Erasure  |

### High Severity

| #   | Gap                                                                                                        | Impact                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 3   | **Australia anonymization path is dead code** — `isAustralia` computed but never used in `executeDeletion` | Compliance violation for AU suppliers under Privacy Act 1988           |
| 4   | **No accessibility testing** — Zero WCAG 2.1 AA verification                                               | Legal liability under European Accessibility Act (effective June 2025) |
| 5   | **No concurrent user integration tests** — All concurrency fixes tested only at unit level with mocks      | WHERE guards validated by code review, not actual DB race conditions   |
| 6   | **Proxy error path not tested per-route** — 7 public route exemptions not individually tested              | A wrong exemption could leak protected routes                          |

### Medium Severity

| #   | Gap                                                                                                    | Impact                                       |
| --- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| 7   | **DocuSign envelope expiration handling** — No mechanism for SENT contracts whose signing link expires | Contracts stuck in SENT state permanently    |
| 8   | **GDPR data inventory not centralized** — Personal data scope spread across export + deletion files    | New tables may miss export/deletion coverage |
| 9   | **Safari ITP localStorage clearing** — 7-day expiry can clear consent record                           | EU user re-consented without notice          |
| 10  | **Rate limiter IP extraction spoofable** — Relies on Vercel-set `x-forwarded-for`                      | If infra changes, rate limiting bypassed     |

---

## 2. Concurrency Specialist Findings

10 race condition scenarios analyzed. Key findings:

### Confirmed Protections (Working Correctly)

- Dual BD approval: Atomic `UPDATE WHERE status='PENDING'` (C-05)
- Contract confirm race: Atomic `WHERE status='PENDING_REVIEW'` (H-02)
- Building double-submit: Atomic `WHERE onboarding_status='previewable'` (M-03)
- DocuSign duplicate webhook: Atomic `WHERE status='SENT'` + idempotency (H-11)
- Field version conflict: DB-level `WHERE version=currentVersion` (M-02)

### Gaps Requiring Strengthening

| #   | Scenario                          | Issue                                                                                             | Fix                                                    |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | **Contract edit optimistic lock** | `updated_at` check is app-level only (line 127), UPDATE (line 139) lacks `.eq("updated_at", ...)` | Add `.eq("updated_at", body.updated_at)` to UPDATE     |
| 2   | **Duplicate email applications**  | TOCTOU between email check and INSERT                                                             | UNIQUE constraint added (manual action #3) closes this |
| 3   | **Webhook silent no-op**          | Second webhook UPDATE returns 0 rows but no warning logged                                        | Add observability logging                              |

---

## 3. Expert Recommendations (Actionable)

### Must-Do (Before Production)

1. **Wrap `executeDeletion` + `approve-supplier` in DB transactions** via `supabase.rpc()` PostgreSQL functions
2. **Add `auth.admin.deleteUser()` to `executeDeletion`** to fully erase auth identity
3. **Fix or remove Australia anonymization dead code** — decide the correct behavior
4. **Strengthen contract edit optimistic lock** — add `WHERE updated_at = ?` to UPDATE statement

### Should-Do (Next Sprint)

5. **Create `atomicStatusUpdate()` utility** — enforce WHERE guards at the type level
6. **Add contract status audit logging** — `contract_id, from_status, to_status, changed_by, changed_at`
7. **Add DocuSign idempotency keys** — store `envelopeId + event` to reject duplicate webhooks
8. **Create `COMPLIANCE_TEST_MODE` env var** — shorten cooling periods, mock external services for CI

### Nice-to-Have

9. **Centralize GDPR data inventory** in a single TypeScript constant
10. **Document rate limiter IP trust assumption** (Vercel-only)

---

## 4. Recommended Testing Tools

| Tool                           | Purpose                                            |
| ------------------------------ | -------------------------------------------------- |
| **k6** (Grafana)               | Load testing API with concurrent virtual users     |
| **Playwright** (parallel mode) | Concurrent browser flows for optimistic locking    |
| **pgtap**                      | PostgreSQL-level RLS policy and constraint testing |
| **Artillery**                  | Lighter API concurrency testing                    |

---

## 5. Minimum Coverage for Confident Release

| Area                          | Target                                    |
| ----------------------------- | ----------------------------------------- |
| `src/lib/` (core logic)       | 80% line coverage                         |
| API routes                    | 60% line coverage                         |
| Compliance + security modules | 100% line coverage                        |
| State machine transitions     | 100% branch coverage                      |
| P0 bug regressions            | 100% test coverage                        |
| E2E smoke tests               | Apply, login, onboard, submit, sign flows |

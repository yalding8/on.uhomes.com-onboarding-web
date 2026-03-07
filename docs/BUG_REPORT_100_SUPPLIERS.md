# Bug Report: 100 Supplier Simulation

> Generated: 2026-03-07
> Method: 6 parallel subagents simulating 100 suppliers (Asia-Pacific / Europe-Middle East / Americas / Edge Cases) + BD/Admin operations + Cross-flow integration testing
> Raw findings: ~105 bugs across 6 groups, deduplicated to 32 unique issues

---

## Severity Summary

| Severity | Count | Description                                                    |
| -------- | ----- | -------------------------------------------------------------- |
| Critical | 4     | Data loss, security breach, or complete flow blockage          |
| High     | 13    | Major functionality broken, authorization gaps, data integrity |
| Medium   | 11    | UX degradation, missing validation, compliance gaps            |
| Low      | 4     | Minor UX issues, cosmetic                                      |

---

## Critical (5)

### C-01: Contract stuck in CONFIRMED if DocuSign fails (no rollback)

- **Sources**: BUG-AP-006, BUG-EU-004, BUG-AM-008, BUG-INT-001, BUG-INT-002
- **File**: `src/lib/contracts/confirm-handlers.ts:57-71`
- **Description**: `handleConfirm()` updates contract to CONFIRMED before calling DocuSign. If `createEnvelope()` fails, contract is permanently stuck — no rollback to PENDING_REVIEW, no retry UI. Status machine only allows CONFIRMED → SENT or CANCELED.
- **Impact**: Supplier permanently blocked from signing. Only manual DB intervention can recover.
- **Test Reproduction**: PARTIALLY CONFIRMED — Error metadata recorded in `provider_metadata`, but contract still stuck in CONFIRMED. Core issue valid.

### C-02: Server-side /api/apply skips Zod validation

- **Sources**: BUG-AP-002, BUG-EU-002, BUG-AM-005, BUG-EC-002
- **File**: `src/app/api/apply/route.ts:21-35`
- **Description**: API only checks field presence and trivial email regex. No phone format, URL, company name length, or supplier_type validation. Direct POST bypasses all client-side Zod schema rules.
- **Impact**: XSS payloads, invalid phones, malicious URLs can be stored in DB.

### C-03: GDPR data export missing critical tables

- **Sources**: BUG-EU-009, BUG-INT-004
- **File**: `src/lib/compliance/data-export.ts:18-55`
- **Description**: `exportSupplierData()` omits `building_onboarding_data`, `field_audit_logs`, `extraction_jobs`. Violates GDPR Article 20 (Right to Data Portability).
- **Impact**: EU suppliers receive incomplete data exports — legal compliance risk.

### ~~C-04~~ H-13 (downgraded): GDPR account deletion — Storage files not cleaned

- **Sources**: BUG-EU-010, BUG-INT-005
- **File**: `src/lib/compliance/account-deletion.ts:99-146`
- **Description**: `executeDeletion()` deletes buildings; child tables (`building_onboarding_data`, `field_audit_logs`, `extraction_jobs`) are cascade-deleted via FK. However, Storage files (signed PDFs, uploaded documents) are NOT deleted. Violates GDPR Article 17 (Right to Erasure).
- **Impact**: Storage files persist after deletion — legal compliance risk.
- **Test Reproduction**: PARTIALLY CONFIRMED — Severity downgraded from Critical to High. Child tables have `ON DELETE CASCADE`, so DB data is properly cleaned. Only Storage files are orphaned.

### C-05: Race condition in supplier approval creates duplicates

- **Sources**: BUG-BD-001, BUG-INT-003, BUG-EC-016
- **File**: `src/app/api/admin/approve-supplier/route.ts:39-166`
- **Description**: Two BDs can approve the same PENDING application simultaneously. Status check and CONVERTED update are non-atomic (no transaction, no WHERE guard). Creates duplicate suppliers, contracts, and auth users.
- **Impact**: Duplicate supplier records, orphaned data.

---

## High (12)

### H-01: Proxy middleware fail-open bypasses all auth on error

- **Source**: BUG-EC-017
- **File**: `src/proxy.ts:35-42`
- **Description**: If `checkRateLimit()` or `updateSession()` throws, catch block returns `NextResponse.next()` — request proceeds unauthenticated and unrate-limited.

### H-02: Contract confirm double-click creates duplicate DocuSign envelopes

- **Source**: BUG-AP-005
- **File**: `src/lib/contracts/confirm-handlers.ts:57-61`
- **Description**: No `WHERE status = 'PENDING_REVIEW'` guard on DB update. Two concurrent requests both pass validation, both call `createEnvelope()`.

### H-03: Any BD can approve applications (should require admin)

- **Sources**: BUG-BD-003, BUG-EC-015
- **File**: `src/app/api/admin/approve-supplier/route.ts:8`
- **Description**: Uses `verifyBdRole()` instead of `verifyAdminRole()`. Any BD can approve applications via API.

### H-04: No BD scoping on contract creation and building status

- **Sources**: BUG-BD-005, BUG-BD-006
- **Files**: `src/app/api/admin/contracts/route.ts`, `src/app/api/admin/buildings/[buildingId]/status/route.ts`
- **Description**: Any BD can create contracts for any supplier and change any building's status — no `bd_user_id` ownership check.

### H-05: PostHog analytics initializes without cookie consent

- **Source**: BUG-EU-011
- **File**: `src/lib/analytics/events.ts:64-71`
- **Description**: `posthog.init()` sets cookies/localStorage before consent banner interaction. Violates GDPR for EU users.

### H-06: US/Canada +1 phone code always resolves to Canada

- **Source**: BUG-AM-001
- **File**: `src/components/form/PhoneInput.tsx:30-38`
- **Description**: `parseValue` iterates country codes sequentially. Canada (+1, index 4) matches before US (+1, index 45). Saved +1 numbers always show Canadian flag on reload.

### H-07: Argentina missing from country codes list

- **Source**: BUG-AM-004
- **File**: `src/data/country-codes.ts`
- **Description**: No entry for Argentina (+54) — Argentine suppliers cannot select their country code.

### H-08: Service key uses timing-unsafe comparison

- **Source**: BUG-INT-007
- **File**: `src/lib/extraction/job-helpers.ts:27-32`
- **Description**: `verifyServiceKey()` uses `===` instead of `crypto.timingSafeEqual()`. Vulnerable to timing attacks on extraction callback endpoint.

### H-09: Signed contract PDFs stored with public URLs

- **Source**: BUG-INT-012
- **File**: `src/app/api/webhooks/docusign/route.ts:69-76`
- **Description**: `getPublicUrl()` generates publicly accessible URLs for signed contracts at predictable paths. Sensitive documents exposed.

### H-10: Login router.refresh() doesn't trigger redirect

- **Sources**: BUG-AP-004, BUG-AM-017
- **File**: `src/app/login/page.tsx:95`
- **Description**: After OTP verification, `router.refresh()` only refreshes RSC data — doesn't trigger middleware redirect. User stuck on login page showing "Verified".

### H-11: DocuSign webhook updates to SIGNED without checking precondition status

- **Source**: BUG-INT-006
- **File**: `src/app/api/webhooks/docusign/route.ts:178-185`
- **Description**: Webhook updates contract to SIGNED without WHERE clause for expected status. Can overwrite concurrent state changes.

### H-12: Missing currencies for Middle East / Eastern Europe

- **Source**: BUG-EU-006
- **File**: `src/lib/onboarding/field-definitions.ts:79`
- **Description**: Currency select only offers 7 options (USD/CAD/GBP/EUR/AUD/JPY/CNY). Missing AED, SAR, TRY, PLN, BRL, MXN, etc.

---

## Medium (11)

### M-01: Rate limiter key fallback to IP for all strategies

- **Sources**: BUG-AM-016, BUG-EU-014, BUG-EC-008
- **File**: `src/lib/security/rate-limit.ts:91-109`
- **Description**: `extractKey()` for user/supplier/email strategies all fall back to IP. Users behind same NAT share rate limit budget.

### M-02: Auto-save stale version closure causes false 409 conflicts

- **Source**: BUG-AM-011
- **File**: `src/components/onboarding/OnboardingForm.tsx:61-121`
- **Description**: Debounced `saveField` captures stale `version` in closure. Rapid field edits trigger false optimistic lock conflicts.

### M-03: Building submit lacks optimistic locking on status

- **Sources**: BUG-AM-009, BUG-EC-012, BUG-INT-008
- **File**: `src/app/api/buildings/[buildingId]/submit/route.ts:52-85`
- **Description**: No `WHERE onboarding_status = 'previewable'` on update. Double-submit or concurrent status change race possible.

### M-04: Deletion eligibility misses PENDING_REVIEW / CONFIRMED contracts

- **Source**: BUG-AP-009
- **File**: `src/lib/compliance/account-deletion.ts:44-48`
- **Description**: Only blocks deletion for DRAFT/SENT contracts. PENDING_REVIEW/CONFIRMED contracts allow deletion, orphaning actionable contracts.

### M-05: Cookie consent banner ignores user country

- **Source**: BUG-EU-013
- **File**: `src/components/compliance/CookieConsentBanner.tsx:31`
- **Description**: `getDefaultConsent()` called without country code. EU strict defaults never applied.

### M-06: Sentry session replay without consent check

- **Source**: BUG-EU-012
- **File**: `src/instrumentation-client.ts`
- **Description**: `replaysOnErrorSampleRate: 1.0` captures session replays for all errors without checking cookie consent.

### M-07: Contract edit optimistic lock is dead code

- **Source**: BUG-BD-007
- **File**: `src/components/admin/ContractEditForm.tsx:114` and `src/app/api/admin/contracts/[contractId]/route.ts:127`
- **Description**: Client never sends `updated_at`. Server check is conditional on its presence — always passes.

### M-08: Duplicate email check is case-sensitive

- **Source**: BUG-AM-007
- **File**: `src/app/api/apply/route.ts:49-54`
- **Description**: `.eq("contact_email", contact_email)` is case-sensitive. Same email with different casing creates duplicate applications.

### M-09: RLS blocks supplier first INSERT to building_onboarding_data

- **Source**: BUG-EC-019
- **File**: `src/app/api/buildings/[buildingId]/fields/route.ts:232-238`
- **Description**: No INSERT RLS policy for suppliers on `building_onboarding_data`. First field edit by supplier fails silently.

### M-10: Deletion scheduled date not persisted in DB

- **Source**: BUG-AP-015
- **File**: `src/lib/compliance/account-deletion.ts:70-93`
- **Description**: 30-day cooling period computed in JS but no `deletion_scheduled_at` column stored. Period unreliable if `updated_at` changes.

### M-11: No input trimming/sanitization on /api/apply

- **Source**: BUG-AM-006
- **File**: `src/app/api/apply/route.ts:91-102`
- **Description**: No `.trim()` or `.toLowerCase()` on any field. Leading/trailing spaces stored, causing duplicate detection failures.

---

## Low (4)

### L-01: Phone code search only matches English country names

- **Source**: BUG-AP-003
- **File**: `src/components/form/PhoneInput.tsx:44-50`

### L-02: Country field is free text with no normalization

- **Sources**: BUG-AP-010, BUG-EU-017
- **File**: `src/components/form/application-schema.ts:14-15`

### L-03: Auto-provisioned BD accounts all named "uhomes BD"

- **Source**: BUG-BD-015
- **File**: `src/lib/supabase/middleware.ts:63`

### L-04: PhoneInput error border uses brand color instead of warning color

- **Source**: BUG-EU-018
- **File**: `src/components/form/PhoneInput.tsx:120-122`

---

## Testing Reproduction Results

> Completed: 2026-03-07 | Method: 4 parallel QA agents validating all 32 bugs against source code

| Result              | Count |
| ------------------- | ----- |
| CONFIRMED           | 28    |
| PARTIALLY CONFIRMED | 4     |
| NOT REPRODUCED      | 0     |

**Partially Confirmed adjustments:**

- **C-01**: Error metadata saved to `provider_metadata`, but contract still stuck — core issue valid
- **C-04 → H-13**: Child tables have `ON DELETE CASCADE` — downgraded to High (only Storage files orphaned)
- **H-02**: Validation is in-memory only (worse than described) — DB has zero concurrency protection
- **M-09**: Code path confirmed but RLS policies require Supabase Dashboard verification

**Revised severity after reproduction:**
| Severity | Count |
|----------|-------|
| Critical | 4 |
| High | 13 |
| Medium | 11 |
| Low | 4 |

---

## Product Review Results

> Completed: 2026-03-07 | Method: 2 parallel expert agents (Security Architect + Product Manager)

### Combined Priority Matrix

| Priority    | Bug IDs                                            | Description                                                  |
| ----------- | -------------------------------------------------- | ------------------------------------------------------------ |
| **P0** (7)  | H-09, C-03, C-01, H-01, C-05, H-05, C-02           | Active GDPR breach, auth bypass, data corruption, stored XSS |
| **P1** (7)  | H-02, H-03, H-04, H-10, H-11, H-13, H-06+H-07+H-12 | Contract flow, authorization, data quality                   |
| **P2** (10) | M-01~M-08, M-10, M-11                              | Consent overhaul, input normalization, optimistic locking    |
| **P3** (4)  | L-01~L-04, M-09                                    | UX polish, RLS verification                                  |

### Recommended Fix Batches

**Batch 1 — P0 Fix Immediately:**

- H-09: Private bucket + signed URLs (Security 9/10)
- C-03: GDPR export add missing tables (Product 10/10)
- C-01 + H-02: Contract state rollback + WHERE guard (Product 9/10)
- H-01: Middleware fail-closed (Security 8/10)
- C-05: Atomic approval with WHERE guard (Security 8/10)
- H-05: PostHog consent gate (Product 8/10)
- C-02: Server-side Zod validation (Security 7/10)

**Batch 2 — P1 This Sprint:**

- H-03: Change `verifyBdRole()` → `verifyAdminRole()`
- H-04: Add BD scoping checks
- H-10: Replace `router.refresh()` with `router.push('/')`
- H-11: Add `WHERE status = 'SENT'` to webhook update
- H-13: Delete Storage files on account deletion
- H-06+H-07+H-12: Phone codes, Argentina, currencies

**Batch 3 — P2 Next Sprint:**

- Consent overhaul (M-05 + M-06)
- Input normalization (M-08 + M-11)
- Optimistic locking fixes (M-02, M-03, M-07)
- Deletion improvements (M-04, M-10)
- Rate limiter fix (M-01)

**Dependency Chains:**

1. C-01 + H-02 — same function, fix atomically
2. C-03 + H-13 — both need complete personal data inventory
3. H-05 + M-05 + M-06 — unified consent architecture
4. M-08 + M-11 — same file, same input pipeline
5. H-06 + H-07 — same data domain

---

## Expert Panel Review Results

> Completed: 2026-03-07 | Panel: Security Architect + Backend Systems Engineer + GDPR Compliance Expert

### P0 Fix Verdicts

| Bug  | Proposed Fix                 | Verdict               | Critical Gaps Identified                                                                                                                           |
| ---- | ---------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| H-09 | Private bucket + signed URLs | AGREE + modify        | Must change bucket ACL at Supabase infra level; migrate existing URLs; audit all `document_url` consumers                                          |
| C-03 | Add missing tables to export | AGREE + modify        | Also missing auth metadata; use admin client; redact internal fields; update `DataExportPackage` type                                              |
| C-01 | Rollback on DocuSign failure | AGREE (rollback only) | "Move status update after" approach rejected — loses audit trail. Must update status machine for CONFIRMED→PENDING_REVIEW; handle rollback failure |
| H-01 | Fail-closed in catch block   | AGREE + modify        | Must exempt public routes (/login, /api/apply, /api/webhooks/\*); ensure redirect target works without auth                                        |
| C-05 | Atomic UPDATE with WHERE     | AGREE + modify        | All rollback paths must reset application status; add UNIQUE constraint on `suppliers.contact_email`; validate `contract_type`                     |
| H-05 | Gate PostHog behind consent  | AGREE + modify        | Also gate `trackEvent`/`identifyUser`; implement consent revocation with PostHog storage cleanup                                                   |
| C-02 | Server-side Zod validation   | AGREE + modify        | Reuse existing `applicantSchema`; use parsed output for DB insert (not raw payload); strip unknown fields; add body size limit                     |

### Red Team Findings (Post-Fix Risks)

1. **H-09**: Old public URLs remain accessible until bucket ACL is changed at infrastructure level — code fix alone is insufficient
2. **H-01**: Redirect to `/login` could loop if `/login` itself depends on `updateSession()` — use a static error page
3. **C-05**: If process fails after `CONVERTING` but before completion, application stuck — need cleanup mechanism for stale `CONVERTING` records
4. **C-02**: Public endpoint with no CAPTCHA — valid-looking spam submissions can flood admin queue
5. **H-05**: localStorage-based consent is not tamper-proof — XSS could forge consent state

---

## Testing Status

| Phase                           | Status                                            |
| ------------------------------- | ------------------------------------------------- |
| Simulation (6 agents)           | Done                                              |
| Testing Reproduction (4 agents) | Done — 28 confirmed, 4 partially confirmed        |
| Product Review (2 agents)       | Done — 7 P0, 7 P1, 10 P2, 4 P3                    |
| Expert Panel Review (3 experts) | Done — all 7 P0 fixes approved with modifications |
| P0 Implementation               | Done — 11 fixes committed (187a552)               |
| P1 Implementation               | Done — 8 fixes committed (4a3cb37)                |
| P2 Implementation               | Pending                                           |

## Manual Action Items (Post-Deployment)

> These items require human intervention and cannot be automated via code changes.

1. **Supabase Dashboard**: Change `signed-contracts` storage bucket from **public** to **private**
2. **Data Migration**: Update existing `contracts.document_url` values from full public URLs to storage paths (`{supplierId}/{contractId}.pdf`)
3. **Supabase Dashboard**: Add UNIQUE constraint on `suppliers.contact_email`
4. **Supabase Dashboard**: Verify RLS INSERT policy exists for suppliers on `building_onboarding_data` (M-09)
5. **Database Migration**: Add `deletion_scheduled_at` column to `suppliers` table (M-10)
6. **GitLab Sync**: Run `git -c http.proxy= -c https.proxy= push gitlab main` when network is available

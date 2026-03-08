# Multi-User Test Scenarios

> Based on: 100-supplier simulation bug fixes (P0-P2 batches)
> Generated: 2026-03-08
> Total scenarios: 32

---

## Category 1: Supplier Self-Service Journey

### S-01: Happy Path — Apply, Onboard, Submit, Sign

- **Actors**: Supplier-A, BD-1
- **Preconditions**: None (new supplier)
- **Steps**:
  1. Supplier-A submits application via `/api/apply` with valid data (company name, email, phone, supplier_type)
  2. BD-1 sees application in admin queue, approves via `/api/admin/approve-supplier`
  3. Supplier-A receives OTP email, logs in
  4. Supplier-A navigates to building onboarding, fills fields until quality score reaches 80+
  5. System auto-transitions building status from `incomplete` to `previewable`
  6. Supplier-A clicks "Submit for Review" — building status moves to `ready_to_publish`
  7. BD-1 creates STANDARD contract for Supplier-A, fills contract fields, pushes to PENDING_REVIEW
  8. Supplier-A reviews contract, confirms — status moves to CONFIRMED
  9. System sends via DocuSign — status moves to SENT
  10. Supplier-A signs — webhook updates status to SIGNED
- **Expected Outcomes**: All status transitions succeed in order. Building reaches `ready_to_publish`. Contract reaches SIGNED.
- **Risk Level**: Baseline — validates the core flow works end-to-end

---

### S-02: Application with Invalid Data (Server-Side Validation)

- **Actors**: Attacker (direct API caller)
- **Preconditions**: None
- **Steps**:
  1. POST to `/api/apply` with XSS payload in company_name: `<script>alert('xss')</script>`
  2. POST to `/api/apply` with invalid phone: `abc123`
  3. POST to `/api/apply` with malicious website URL: `javascript:void(0)`
  4. POST to `/api/apply` with empty required fields
  5. POST to `/api/apply` with company_name exceeding max length
- **Expected Outcomes**: All requests rejected with 400 and specific Zod validation errors. No data stored in DB.
- **Risk Level**: Prevents C-02 regression (server-side Zod validation bypass)

---

### S-03: Duplicate Application Detection (Case-Insensitive)

- **Actors**: Supplier-A
- **Preconditions**: Supplier-A already applied with `John@Example.com`
- **Steps**:
  1. Supplier-A submits again with `john@example.com`
  2. Supplier-A submits again with `JOHN@EXAMPLE.COM`
  3. Supplier-A submits again with `john@example.com` (leading/trailing spaces)
- **Expected Outcomes**: All three attempts rejected as duplicates. Input is trimmed and lowercased before comparison.
- **Risk Level**: Prevents M-08 + M-11 regression (case-sensitive email check, no input trimming)

---

### S-04: Supplier Login Redirect After OTP Verification

- **Actors**: Supplier-A
- **Preconditions**: Supplier-A has an approved account
- **Steps**:
  1. Supplier-A navigates to `/login`, enters email
  2. Supplier-A receives OTP, enters code
  3. OTP verification succeeds
  4. Page redirects to supplier dashboard (not stuck on login page)
- **Expected Outcomes**: After OTP verification, user is redirected to `/` or `/dashboard` within 2 seconds. No "Verified" stuck state.
- **Risk Level**: Prevents H-10 regression (router.refresh() not triggering redirect)

---

### S-05: Building Quality Score Threshold Transitions

- **Actors**: Supplier-A
- **Preconditions**: Building created, status `incomplete`, quality score 75
- **Steps**:
  1. Supplier-A fills additional fields, score rises to 80 — status should transition to `previewable`
  2. Supplier-A clears a required field, score drops to 78 — status should transition back to `incomplete`
  3. Supplier-A refills field, score returns to 82 — status should transition to `previewable`
  4. Supplier-A submits building — status moves to `ready_to_publish`
  5. Supplier-A clears a field (score drops to 70) — status should remain `ready_to_publish` (locked)
- **Expected Outcomes**: Score-driven transitions work correctly. `ready_to_publish` is a locked status not affected by score changes.
- **Risk Level**: Validates status-engine threshold logic

---

### S-06: Building Submit Double-Click Prevention

- **Actors**: Supplier-A
- **Preconditions**: Building in `previewable` status, score >= 80
- **Steps**:
  1. Supplier-A clicks "Submit" button
  2. Before response returns, Supplier-A clicks "Submit" again (simulated with concurrent POST)
  3. Both requests hit `/api/buildings/[buildingId]/submit` simultaneously
- **Expected Outcomes**: Exactly one request succeeds. Second request fails with 409 conflict due to `WHERE onboarding_status = 'previewable'` guard. Building submitted exactly once.
- **Risk Level**: Prevents M-03 regression (missing optimistic locking on building submit)

---

### S-07: Supplier First Field Edit (RLS INSERT Policy)

- **Actors**: Supplier-A
- **Preconditions**: New building created, no rows in `building_onboarding_data` for this building
- **Steps**:
  1. Supplier-A edits the first field on the onboarding form
  2. System attempts INSERT into `building_onboarding_data`
- **Expected Outcomes**: INSERT succeeds. RLS INSERT policy allows supplier to create their own building data row.
- **Risk Level**: Prevents M-09 regression (RLS blocks supplier first INSERT)

---

### S-08: Auto-Save Stale Version Conflict

- **Actors**: Supplier-A
- **Preconditions**: Building with onboarding data at version 5
- **Steps**:
  1. Supplier-A types rapidly in field-A (triggers debounced save with version 5)
  2. Before debounce fires, Supplier-A switches to field-B and types (triggers another debounced save)
  3. First save fires with version 5, succeeds, server returns version 6
  4. Second save fires — should use version 6 (not stale version 5)
- **Expected Outcomes**: No false 409 conflict. The closure captures the latest version, not a stale one.
- **Risk Level**: Prevents M-02 regression (stale version closure in auto-save)

---

## Category 2: BD Collaborative Workflow

### B-01: BD Creates and Manages Contract Through Full Lifecycle

- **Actors**: BD-1, Supplier-A
- **Preconditions**: Supplier-A is approved, assigned to BD-1
- **Steps**:
  1. BD-1 creates contract for Supplier-A via `/api/admin/contracts` (status: DRAFT)
  2. BD-1 edits contract fields (company name, commission rate, dates, covered properties)
  3. BD-1 pushes contract to PENDING_REVIEW
  4. BD-1 realizes a mistake, transitions back to DRAFT
  5. BD-1 re-edits, pushes to PENDING_REVIEW again
  6. Supplier-A reviews and confirms — CONFIRMED
  7. System sends to DocuSign — SENT
  8. Supplier-A signs — SIGNED (terminal state)
- **Expected Outcomes**: Each transition is valid per status machine. Contract is only editable in DRAFT. SIGNED is terminal.
- **Risk Level**: Validates contract status machine transitions

---

### B-02: Contract Confirm with DocuSign Failure and Rollback

- **Actors**: BD-1, Supplier-A
- **Preconditions**: Contract in PENDING_REVIEW status
- **Steps**:
  1. Supplier-A confirms contract — status moves to CONFIRMED
  2. System calls DocuSign `createEnvelope()` — call fails (network error, API error, etc.)
  3. System automatically rolls back contract status from CONFIRMED to PENDING_REVIEW
  4. Error details stored in `provider_metadata`
  5. BD-1 or Supplier-A can re-attempt confirmation
- **Expected Outcomes**: Contract is NOT stuck in CONFIRMED. Rollback to PENDING_REVIEW occurs. Retry is possible.
- **Risk Level**: Prevents C-01 regression (contract stuck in CONFIRMED if DocuSign fails)

---

### B-03: Contract Confirm Double-Click (Duplicate Envelope Prevention)

- **Actors**: Supplier-A
- **Preconditions**: Contract in PENDING_REVIEW status
- **Steps**:
  1. Supplier-A clicks "Confirm" button
  2. Before response returns, Supplier-A clicks "Confirm" again
  3. Both requests hit `/api/contracts/[contractId]/confirm` simultaneously
- **Expected Outcomes**: Exactly one DocuSign envelope created. Second request fails due to `WHERE status = 'PENDING_REVIEW'` guard. No duplicate envelopes.
- **Risk Level**: Prevents H-02 regression (double-click creates duplicate DocuSign envelopes)

---

### B-04: Contract Edit Optimistic Lock Enforcement

- **Actors**: BD-1, BD-2
- **Preconditions**: Contract in DRAFT status, both BDs have the edit form open
- **Steps**:
  1. BD-1 loads contract edit form, receives `updated_at = T1`
  2. BD-2 loads contract edit form, receives `updated_at = T1`
  3. BD-1 saves edits — request includes `updated_at = T1`, succeeds, server sets `updated_at = T2`
  4. BD-2 saves edits — request includes `updated_at = T1`, which no longer matches server's T2
- **Expected Outcomes**: BD-2's save is rejected with 409 Conflict. Client sends `updated_at` and server enforces the check.
- **Risk Level**: Prevents M-07 regression (contract edit optimistic lock is dead code)

---

### B-05: BD Authorization Scoping

- **Actors**: BD-1, BD-2, Supplier-A, Supplier-B
- **Preconditions**: Supplier-A assigned to BD-1, Supplier-B assigned to BD-2
- **Steps**:
  1. BD-1 attempts to create a contract for Supplier-B (not assigned to them)
  2. BD-1 attempts to change building status for Supplier-B's building
  3. BD-2 attempts to edit BD-1's contracts
- **Expected Outcomes**: All cross-BD operations are rejected with 403 Forbidden. BD scoping enforced.
- **Risk Level**: Prevents H-04 regression (no BD scoping on contract creation and building status)

---

## Category 3: Multi-BD Conflict

### C-01: Two BDs Approve Same Application Simultaneously

- **Actors**: BD-1, BD-2
- **Preconditions**: Application from Supplier-A in PENDING status
- **Steps**:
  1. BD-1 clicks "Approve" for Supplier-A
  2. BD-2 clicks "Approve" for Supplier-A at the same instant (within 100ms)
  3. Both requests hit `/api/admin/approve-supplier` concurrently
- **Expected Outcomes**: Exactly one approval succeeds. The atomic `WHERE status = 'PENDING'` guard ensures only one request can transition the status. Second request gets 409. No duplicate suppliers, contracts, or auth users created.
- **Risk Level**: Prevents C-05 regression (race condition creating duplicate suppliers)

---

### C-02: Two BDs Edit Same Contract Fields Concurrently

- **Actors**: BD-1, BD-2
- **Preconditions**: Contract in DRAFT status, assigned to BD-1's supplier
- **Steps**:
  1. BD-1 opens contract edit form at time T0
  2. BD-2 opens the same contract edit form at time T0
  3. BD-1 changes commission_rate to "15%", saves at T1
  4. BD-2 changes commission_rate to "12%", saves at T2
- **Expected Outcomes**: BD-1's save succeeds. BD-2's save is rejected with 409 (stale `updated_at`). BD-2 must reload and re-edit. No silent data overwrite.
- **Risk Level**: Prevents data corruption from concurrent edits (M-07)

---

### C-03: BD Changes Building Status While Another BD Also Manages It

- **Actors**: BD-1, BD-2
- **Preconditions**: Supplier-A's building in `previewable` status
- **Steps**:
  1. BD-1 attempts to change building status to `ready_to_publish`
  2. BD-2 simultaneously attempts to change the same building status to `incomplete` (rejection)
- **Expected Outcomes**: Only one operation succeeds. If BD scoping is enforced, only the assigned BD can modify. If both are authorized, the first write wins and the second gets a conflict error.
- **Risk Level**: Validates concurrent building status change protection

---

## Category 4: Supplier + BD Concurrent Edit

### D-01: Supplier Edits Building While BD Changes Building Status

- **Actors**: Supplier-A, BD-1
- **Preconditions**: Building in `previewable` status, score = 85
- **Steps**:
  1. Supplier-A starts editing a field (auto-save pending)
  2. BD-1 changes building status to `ready_to_publish` via admin API
  3. Supplier-A's auto-save fires, which would lower the score to 78
  4. Status engine checks: building is in `ready_to_publish` (locked status)
- **Expected Outcomes**: BD-1's status change succeeds. Supplier-A's field edit saves, but the status remains `ready_to_publish` because it is a locked status. Score updates but does not trigger status regression.
- **Risk Level**: Validates locked status behavior in status-engine

---

### D-02: Supplier Confirms Contract While BD Pushes Back to DRAFT

- **Actors**: Supplier-A, BD-1
- **Preconditions**: Contract in PENDING_REVIEW status
- **Steps**:
  1. Supplier-A clicks "Confirm" (confirm request in flight)
  2. BD-1 simultaneously pushes contract back to DRAFT (rollback request in flight)
  3. Both requests arrive at server nearly simultaneously
- **Expected Outcomes**: Exactly one operation succeeds based on which acquires the row-level lock first. The losing request gets a 409 error. Contract ends in either CONFIRMED or DRAFT, never in an inconsistent state.
- **Risk Level**: Validates concurrent status transition safety

---

### D-03: Supplier Submits Building While BD Rejects It

- **Actors**: Supplier-A, BD-1
- **Preconditions**: Building in `previewable` status
- **Steps**:
  1. Supplier-A clicks "Submit for Review" via `/api/buildings/[buildingId]/submit`
  2. BD-1 simultaneously changes building status to `incomplete` via admin endpoint
- **Expected Outcomes**: Only one operation succeeds. The `WHERE onboarding_status = 'previewable'` guard on the submit endpoint ensures atomicity.
- **Risk Level**: Prevents M-03 regression

---

## Category 5: Admin Override Scenarios

### A-01: Admin Approves Application (Authorization Check)

- **Actors**: Admin, BD-1
- **Preconditions**: Application in PENDING status
- **Steps**:
  1. BD-1 attempts to approve via `/api/admin/approve-supplier`
  2. Admin attempts to approve via the same endpoint
- **Expected Outcomes**: BD-1's request is rejected with 403 (requires admin role, not BD role). Admin's request succeeds.
- **Risk Level**: Prevents H-03 regression (any BD can approve applications)

---

### A-02: Admin Cancels Contract That BD Is Editing

- **Actors**: Admin, BD-1
- **Preconditions**: Contract in DRAFT status, BD-1 has edit form open
- **Steps**:
  1. Admin cancels the contract (DRAFT -> CANCELED)
  2. BD-1 tries to save edits to the now-CANCELED contract
  3. BD-1 tries to push the contract to PENDING_REVIEW
- **Expected Outcomes**: Admin's cancel succeeds. BD-1's edit save is rejected (contract not editable in CANCELED). BD-1's status change is rejected (CANCELED is terminal). Clear error messages returned.
- **Risk Level**: Validates terminal state enforcement

---

### A-03: Admin Intervenes in Stuck Contract (CONFIRMED -> PENDING_REVIEW Rollback)

- **Actors**: Admin, Supplier-A
- **Preconditions**: Contract stuck in CONFIRMED after DocuSign failure (if rollback somehow failed)
- **Steps**:
  1. Admin manually transitions contract from CONFIRMED to PENDING_REVIEW
  2. Supplier-A can now re-confirm the contract
  3. DocuSign succeeds this time — CONFIRMED -> SENT -> SIGNED
- **Expected Outcomes**: Admin can trigger the CONFIRMED -> PENDING_REVIEW transition (allowed by status machine). Recovery flow works end-to-end.
- **Risk Level**: Validates C-01 manual recovery path

---

### A-04: Admin Assigns BD to Supplier Mid-Workflow

- **Actors**: Admin, BD-1, BD-2, Supplier-A
- **Preconditions**: Supplier-A assigned to BD-1, contract in DRAFT
- **Steps**:
  1. Admin reassigns Supplier-A from BD-1 to BD-2
  2. BD-1 attempts to edit Supplier-A's contract — rejected (no longer assigned)
  3. BD-2 edits and progresses the contract
- **Expected Outcomes**: BD reassignment takes effect immediately. BD-1 loses access. BD-2 gains access.
- **Risk Level**: Validates BD scoping after reassignment

---

## Category 6: Account Lifecycle

### L-01: Deletion Request with Active Contracts

- **Actors**: Supplier-A
- **Preconditions**: Supplier-A has contracts in DRAFT, PENDING_REVIEW, CONFIRMED, and SENT statuses
- **Steps**:
  1. Supplier-A requests account deletion via `/api/account/delete`
  2. System checks deletion eligibility
- **Expected Outcomes**: Deletion blocked. Response includes blocker for all 4 active contracts with message "Please resolve all pending contracts before requesting deletion." All contract statuses (DRAFT, PENDING_REVIEW, CONFIRMED, SENT) are checked.
- **Risk Level**: Prevents M-04 regression (deletion eligibility misses PENDING_REVIEW/CONFIRMED)

---

### L-02: Deletion Request After All Contracts Resolved

- **Actors**: Supplier-A
- **Preconditions**: Supplier-A has one SIGNED contract and one CANCELED contract (both terminal). No published buildings.
- **Steps**:
  1. Supplier-A requests account deletion
  2. System marks supplier for deletion with 30-day cooling period
  3. `deletion_scheduled_at` column is set in DB
  4. After cooling period, `executeDeletion()` runs
  5. Verify: Storage files deleted from `signed-contracts` and `uploaded-contracts` buckets
  6. Verify: Buildings and cascaded child tables deleted
  7. Verify: Contracts anonymized (document_url and signature_fields nulled)
  8. Verify: Application record deleted
  9. Verify: Supplier record deleted
- **Expected Outcomes**: Full cleanup including Storage files. `deletion_scheduled_at` persisted in DB (not just computed in JS).
- **Risk Level**: Prevents H-13 (storage files not cleaned) and M-10 (deletion date not persisted)

---

### L-03: GDPR Data Export Completeness

- **Actors**: Supplier-A (EU-based)
- **Preconditions**: Supplier-A has buildings with onboarding data, field audit logs, extraction jobs, and contracts
- **Steps**:
  1. Supplier-A requests data export via `/api/account/export`
  2. System generates export package
  3. Verify export includes: supplier profile, applications, buildings, `building_onboarding_data`, `field_audit_logs`, `extraction_jobs`, contracts
  4. Verify auth metadata is included
  5. Verify internal fields are redacted
- **Expected Outcomes**: Export contains ALL personal data tables. No table omitted. Meets GDPR Article 20 (Right to Data Portability).
- **Risk Level**: Prevents C-03 regression (GDPR export missing critical tables)

---

### L-04: Deletion with Published Buildings (Blocker)

- **Actors**: Supplier-A
- **Preconditions**: Supplier-A has 2 published buildings
- **Steps**:
  1. Supplier-A requests deletion
  2. System returns blocker: "Please unpublish all listings before requesting account deletion" with count: 2
  3. Supplier-A unpublishes both buildings
  4. Supplier-A re-requests deletion — now succeeds
- **Expected Outcomes**: Published buildings block deletion. After unpublishing, deletion proceeds.
- **Risk Level**: Validates deletion eligibility with active bookings

---

## Category 7: Edge Cases

### E-01: US vs Canada Phone Code Resolution (+1)

- **Actors**: Supplier-US, Supplier-CA
- **Preconditions**: None
- **Steps**:
  1. Supplier-US applies with phone `+1 415 555 1234` and selects US flag
  2. Supplier-CA applies with phone `+1 416 555 1234` and selects Canada flag
  3. Supplier-US logs in later, views profile — phone should show US flag, not Canada
  4. Supplier-CA logs in later, views profile — phone should show Canada flag
- **Expected Outcomes**: Country code stored alongside phone number (not just `+1`). Reload correctly displays the right flag.
- **Risk Level**: Prevents H-06 regression (US/Canada +1 always resolves to Canada)

---

### E-02: Missing Currency for Middle Eastern Supplier

- **Actors**: Supplier-UAE
- **Preconditions**: None
- **Steps**:
  1. Supplier-UAE reaches the currency selection field during onboarding
  2. Looks for AED (UAE Dirham) in the dropdown
- **Expected Outcomes**: AED is available in the currency list. Also verify: SAR, TRY, PLN, BRL, MXN are present.
- **Risk Level**: Prevents H-12 regression (missing currencies for Middle East / Eastern Europe)

---

### E-03: Argentine Supplier Phone Code

- **Actors**: Supplier-AR
- **Preconditions**: None
- **Steps**:
  1. Supplier-AR opens the phone input, searches for Argentina
  2. Selects +54 country code
  3. Enters phone number and submits
- **Expected Outcomes**: Argentina (+54) appears in the country code list. Phone saves correctly.
- **Risk Level**: Prevents H-07 regression (Argentina missing from country codes)

---

### E-04: Cookie Consent for EU Supplier (Analytics Gating)

- **Actors**: Supplier-EU (Germany)
- **Preconditions**: Supplier-EU has not interacted with consent banner
- **Steps**:
  1. Supplier-EU lands on the site — consent banner appears
  2. Before interacting with banner, verify: no PostHog cookies set, no Sentry session replay active
  3. Supplier-EU rejects analytics cookies
  4. Verify: PostHog remains uninitialized, no tracking events fire
  5. Supplier-EU accepts analytics cookies
  6. Verify: PostHog initializes, tracking events fire
- **Expected Outcomes**: No analytics/tracking before consent. EU default is strict (deny until explicit accept). Country-aware consent defaults applied.
- **Risk Level**: Prevents H-05 + M-05 + M-06 regression (PostHog/Sentry without consent, consent ignoring country)

---

### E-05: Proxy Middleware Fail-Closed Behavior

- **Actors**: Any user
- **Preconditions**: `checkRateLimit()` or `updateSession()` throws an unexpected error
- **Steps**:
  1. Simulate middleware error (rate limiter throws, session update throws)
  2. Request hits a protected route (e.g., `/dashboard`)
  3. Request hits a public route (e.g., `/login`, `/api/apply`, `/api/webhooks/docusign`)
- **Expected Outcomes**: Protected route: request is blocked, user redirected to a static error page (not `/login` to avoid redirect loop). Public route: request proceeds normally (exempted from fail-closed). No unauthenticated access to protected resources.
- **Risk Level**: Prevents H-01 regression (middleware fail-open bypasses all auth)

---

### E-06: DocuSign Webhook Status Precondition Check

- **Actors**: DocuSign webhook
- **Preconditions**: Contract in SENT status
- **Steps**:
  1. DocuSign webhook fires with "completed" event — contract should transition SENT -> SIGNED
  2. Admin simultaneously cancels the contract (SENT -> SIGNED is valid but CANCELED -> SIGNED is not)
  3. Webhook arrives after cancel — contract is now CANCELED
- **Expected Outcomes**: Webhook update includes `WHERE status = 'SENT'` guard. If contract was canceled, webhook update silently fails (0 rows updated). Contract remains CANCELED. No overwrite of concurrent state changes.
- **Risk Level**: Prevents H-11 regression (webhook updates to SIGNED without checking precondition)

---

### E-07: Signed Contract PDF Access Control

- **Actors**: Supplier-A, Supplier-B (unauthorized)
- **Preconditions**: Supplier-A has a signed contract with PDF stored in `signed-contracts` bucket
- **Steps**:
  1. Supplier-A requests download of their signed contract via `/api/contracts/[contractId]/download`
  2. Supplier-B attempts to access Supplier-A's contract PDF by guessing the storage path
  3. Supplier-B attempts to access via direct Supabase storage URL
- **Expected Outcomes**: Supplier-A gets a time-limited signed URL. Supplier-B's guessed URL returns 403 (private bucket). Direct storage URLs are not publicly accessible.
- **Risk Level**: Prevents H-09 regression (signed contracts stored with public URLs)

---

### E-08: Service Key Timing-Safe Comparison

- **Actors**: Attacker (extraction callback endpoint)
- **Preconditions**: Attacker has partial knowledge of service key
- **Steps**:
  1. Attacker sends requests to `/api/extraction/callback` with incremental key guesses
  2. Measure response times for each guess
- **Expected Outcomes**: Response times are constant regardless of how many characters match. `crypto.timingSafeEqual()` used instead of `===`. No timing oracle.
- **Risk Level**: Prevents H-08 regression (timing-unsafe comparison)

---

### E-09: Rate Limiter Key Isolation (Shared NAT)

- **Actors**: Supplier-A, Supplier-B (behind same corporate NAT/VPN)
- **Preconditions**: Both suppliers share the same external IP address
- **Steps**:
  1. Supplier-A makes 8 requests to a rate-limited endpoint (limit: 10/min)
  2. Supplier-B makes 5 requests to the same endpoint
  3. If rate limit key is IP-only, Supplier-B would be blocked (8+5 > 10)
  4. If rate limit key uses user/session ID, both should be within their individual limits
- **Expected Outcomes**: When user is authenticated, rate limit key uses user ID (not IP). Each supplier has independent rate limit budget.
- **Risk Level**: Prevents M-01 regression (rate limiter key fallback to IP)

---

### E-10: Contract Status Terminal State Enforcement

- **Actors**: BD-1, Admin
- **Preconditions**: Contract-1 in SIGNED status, Contract-2 in CANCELED status
- **Steps**:
  1. BD-1 attempts SIGNED -> DRAFT transition on Contract-1
  2. BD-1 attempts SIGNED -> CANCELED transition on Contract-1
  3. Admin attempts CANCELED -> DRAFT transition on Contract-2
  4. Admin attempts any transition on Contract-2
- **Expected Outcomes**: All four attempts rejected. SIGNED and CANCELED are terminal states per the status machine. Error messages include: "SIGNED/CANCELED is a terminal state, cannot transition to any other state."
- **Risk Level**: Validates status machine terminal state enforcement

---

## Execution Notes

### Priority Order

1. **P0 Regression Tests** (scenarios that directly validate P0 fixes): S-02, S-03, C-01, B-02, B-03, L-03, E-04, E-05, E-07
2. **P1 Regression Tests**: A-01, B-04, B-05, S-04, E-01, E-02, E-03, E-06, L-01, L-02
3. **Concurrency Tests** (require parallel request tooling): S-06, C-01, C-02, D-01, D-02, D-03, B-03
4. **Remaining Scenarios**: S-01, S-05, S-07, S-08, B-01, C-03, A-02, A-03, A-04, L-04, E-08, E-09, E-10

### Test Infrastructure Requirements

- **Concurrent request simulation**: Tools like `k6`, `artillery`, or custom scripts to fire parallel HTTP requests within 100ms windows
- **Multiple authenticated sessions**: At least 3 supplier accounts, 2 BD accounts, 1 admin account
- **DocuSign sandbox**: For contract confirm/sign flow testing (B-02, B-03)
- **Storage bucket verification**: Supabase CLI or dashboard access to verify bucket privacy settings and file cleanup
- **Network simulation**: Ability to inject failures in DocuSign calls for rollback testing (B-02)

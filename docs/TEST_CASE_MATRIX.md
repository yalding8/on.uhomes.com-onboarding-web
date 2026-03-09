# Test Case Matrix — uhomes Supplier Onboarding Portal

> QA Test Lead: Designed 2026-03-08
> Methodology: State Transition Coverage + Pairwise Combinatorial + Boundary Value Analysis + Equivalence Partitioning + Concurrency Matrix
> Total Test Cases: 147

---

## 1. Test Case Template

Every test case follows this standardized format:

| Field               | Description                                                                                                                              |
| :------------------ | :--------------------------------------------------------------------------------------------------------------------------------------- |
| **ID**              | `TC-{category}-{number}` (e.g., TC-CSM-001)                                                                                              |
| **Category**        | CSM (Contract State Machine), BSM (Building State Machine), CON (Concurrency), AUTH (Authorization), VAL (Validation), COMP (Compliance) |
| **Title**           | One-line description of what is tested                                                                                                   |
| **Preconditions**   | Required state/data before test execution                                                                                                |
| **Input/Action**    | Exact operation performed                                                                                                                |
| **Expected Result** | Specific, verifiable outcome                                                                                                             |
| **Priority**        | P0 (blocker), P1 (critical), P2 (important), P3 (nice-to-have)                                                                           |
| **Technique**       | BVA / EP / StateTransition / Pairwise / Concurrency                                                                                      |
| **Related Bugs**    | Bug IDs from BUG_REPORT_100_SUPPLIERS.md (if regression)                                                                                 |

---

## 2. State Transition Test Matrix

### 2.1 Contract State Machine

States: `DRAFT`, `PENDING_REVIEW`, `CONFIRMED`, `SENT`, `SIGNED`, `CANCELED`

Valid transitions (from `status-machine.ts`):

```
DRAFT           → PENDING_REVIEW, CANCELED
PENDING_REVIEW  → CONFIRMED, DRAFT, CANCELED
CONFIRMED       → SENT, CANCELED, PENDING_REVIEW
SENT            → SIGNED, SENT (resend)
SIGNED          → (terminal)
CANCELED        → (terminal)
```

#### 2.1.1 Valid Transition Tests

| ID         | From           | To             | Trigger                                | Priority | Related Bugs |
| :--------- | :------------- | :------------- | :------------------------------------- | :------- | :----------- |
| TC-CSM-001 | DRAFT          | PENDING_REVIEW | BD submits contract for review         | P0       | —            |
| TC-CSM-002 | DRAFT          | CANCELED       | BD cancels draft contract              | P1       | —            |
| TC-CSM-003 | PENDING_REVIEW | CONFIRMED      | Admin confirms contract                | P0       | C-01, H-02   |
| TC-CSM-004 | PENDING_REVIEW | DRAFT          | Admin requests changes                 | P1       | —            |
| TC-CSM-005 | PENDING_REVIEW | CANCELED       | Admin cancels contract                 | P1       | —            |
| TC-CSM-006 | CONFIRMED      | SENT           | DocuSign envelope created successfully | P0       | C-01         |
| TC-CSM-007 | CONFIRMED      | CANCELED       | Admin cancels after confirm            | P1       | —            |
| TC-CSM-008 | CONFIRMED      | PENDING_REVIEW | DocuSign fails, rollback               | P0       | C-01         |
| TC-CSM-009 | SENT           | SIGNED         | DocuSign webhook: completed            | P0       | H-11         |
| TC-CSM-010 | SENT           | SENT           | BD resends envelope                    | P1       | —            |

#### 2.1.2 Invalid Transition Tests (Rejection)

| ID         | From           | To             | Expected                   | Priority | Technique       |
| :--------- | :------------- | :------------- | :------------------------- | :------- | :-------------- |
| TC-CSM-011 | SIGNED         | DRAFT          | Reject: terminal state     | P0       | StateTransition |
| TC-CSM-012 | SIGNED         | CANCELED       | Reject: terminal state     | P0       | StateTransition |
| TC-CSM-013 | SIGNED         | PENDING_REVIEW | Reject: terminal state     | P1       | StateTransition |
| TC-CSM-014 | CANCELED       | DRAFT          | Reject: terminal state     | P0       | StateTransition |
| TC-CSM-015 | CANCELED       | PENDING_REVIEW | Reject: terminal state     | P1       | StateTransition |
| TC-CSM-016 | DRAFT          | CONFIRMED      | Reject: skip not allowed   | P1       | StateTransition |
| TC-CSM-017 | DRAFT          | SENT           | Reject: skip not allowed   | P1       | StateTransition |
| TC-CSM-018 | DRAFT          | SIGNED         | Reject: skip not allowed   | P1       | StateTransition |
| TC-CSM-019 | PENDING_REVIEW | SENT           | Reject: must confirm first | P1       | StateTransition |
| TC-CSM-020 | PENDING_REVIEW | SIGNED         | Reject: skip not allowed   | P1       | StateTransition |
| TC-CSM-021 | CONFIRMED      | DRAFT          | Reject: no direct path     | P2       | StateTransition |
| TC-CSM-022 | CONFIRMED      | SIGNED         | Reject: must send first    | P1       | StateTransition |
| TC-CSM-023 | SENT           | DRAFT          | Reject: no backward path   | P1       | StateTransition |
| TC-CSM-024 | SENT           | PENDING_REVIEW | Reject: no backward path   | P2       | StateTransition |
| TC-CSM-025 | SENT           | CANCELED       | Reject: not in transitions | P1       | StateTransition |

#### 2.1.3 Self-Transition Tests

| ID         | From           | To             | Expected                   | Priority |
| :--------- | :------------- | :------------- | :------------------------- | :------- |
| TC-CSM-026 | DRAFT          | DRAFT          | Reject: "status unchanged" | P2       |
| TC-CSM-027 | PENDING_REVIEW | PENDING_REVIEW | Reject: "status unchanged" | P2       |
| TC-CSM-028 | CONFIRMED      | CONFIRMED      | Reject: "status unchanged" | P2       |

#### 2.1.4 Contract Editability Tests

| ID         | Status         | Expected Editable | Priority |
| :--------- | :------------- | :---------------- | :------- |
| TC-CSM-029 | DRAFT          | Yes               | P0       |
| TC-CSM-030 | PENDING_REVIEW | No                | P0       |
| TC-CSM-031 | CONFIRMED      | No                | P1       |
| TC-CSM-032 | SENT           | No                | P1       |
| TC-CSM-033 | SIGNED         | No                | P1       |
| TC-CSM-034 | CANCELED       | No                | P1       |

---

### 2.2 Building Status Machine

States: `extracting`, `incomplete`, `previewable`, `ready_to_publish`, `published`

Score-driven transitions (from `status-engine.ts`):

```
extracting       → (locked, no score-driven change)
incomplete       → previewable  (when score crosses 80 upward)
previewable      → incomplete   (when score drops below 80)
previewable      → ready_to_publish  (user submit action)
ready_to_publish → (locked, no score-driven change)
published        → (locked, no score-driven change)
```

#### 2.2.1 Score-Driven Transition Tests

| ID         | Current Status | Old Score | New Score | Expected Status | Priority | Technique            |
| :--------- | :------------- | :-------- | :-------- | :-------------- | :------- | :------------------- |
| TC-BSM-001 | incomplete     | 75        | 80        | previewable     | P0       | BVA                  |
| TC-BSM-002 | incomplete     | 79        | 80        | previewable     | P0       | BVA (boundary)       |
| TC-BSM-003 | incomplete     | 79        | 79        | incomplete      | P1       | BVA (boundary-1)     |
| TC-BSM-004 | incomplete     | 0         | 100       | previewable     | P1       | BVA (max)            |
| TC-BSM-005 | incomplete     | 79        | 81        | previewable     | P1       | BVA (boundary+1)     |
| TC-BSM-006 | previewable    | 80        | 79        | incomplete      | P0       | BVA (boundary)       |
| TC-BSM-007 | previewable    | 85        | 79        | incomplete      | P1       | BVA                  |
| TC-BSM-008 | previewable    | 80        | 80        | previewable     | P1       | BVA (no change)      |
| TC-BSM-009 | previewable    | 90        | 95        | previewable     | P2       | EP (above threshold) |
| TC-BSM-010 | incomplete     | 50        | 60        | incomplete      | P2       | EP (below threshold) |

#### 2.2.2 Locked Status Tests (No Score-Driven Change)

| ID         | Current Status   | Old Score | New Score | Expected Status  | Priority |
| :--------- | :--------------- | :-------- | :-------- | :--------------- | :------- |
| TC-BSM-011 | extracting       | 0         | 90        | extracting       | P0       |
| TC-BSM-012 | ready_to_publish | 85        | 50        | ready_to_publish | P0       |
| TC-BSM-013 | published        | 90        | 30        | published        | P0       |
| TC-BSM-014 | extracting       | 50        | 79        | extracting       | P1       |

#### 2.2.3 Building Submit Tests

| ID         | Current Status   | Required Fields | Expected                     | Priority | Related Bugs |
| :--------- | :--------------- | :-------------- | :--------------------------- | :------- | :----------- |
| TC-BSM-015 | previewable      | All present     | 200, status=ready_to_publish | P0       | M-03         |
| TC-BSM-016 | previewable      | 1 missing       | 422, list missing fields     | P0       | —            |
| TC-BSM-017 | incomplete       | All present     | 422, "score must reach 80"   | P1       | —            |
| TC-BSM-018 | extracting       | N/A             | 422, "score must reach 80"   | P1       | —            |
| TC-BSM-019 | ready_to_publish | All present     | 422, "already submitted"     | P1       | —            |
| TC-BSM-020 | published        | All present     | 422, "already submitted"     | P1       | —            |
| TC-BSM-021 | previewable      | All missing     | 422, list all missing fields | P2       | —            |

---

## 3. Concurrency Test Matrix

Each scenario defines two actors performing operations with overlapping timing.

### 3.1 Contract Confirm Race (C-01 + H-02 Regression)

| ID         | Actor A Action     | Actor B Action     | Timing        | Expected Winner            | Expected Loser                  | Priority |
| :--------- | :----------------- | :----------------- | :------------ | :------------------------- | :------------------------------ | :------- |
| TC-CON-001 | Confirm contract X | Confirm contract X | Simultaneous  | First to claim WHERE guard | 409 "already being processed"   | P0       |
| TC-CON-002 | Confirm contract X | Cancel contract X  | A first by ms | A (CONFIRMED)              | B gets 409 or stale status      | P0       |
| TC-CON-003 | Cancel contract X  | Confirm contract X | A first by ms | A (CANCELED)               | B gets 400 (invalid transition) | P0       |

### 3.2 Supplier Approval Race (C-05 Regression)

| ID         | Actor A Action        | Actor B Action        | Timing       | Expected Winner                   | Expected Loser                | Priority |
| :--------- | :-------------------- | :-------------------- | :----------- | :-------------------------------- | :---------------------------- | :------- |
| TC-CON-004 | Approve application X | Approve application X | Simultaneous | First to claim PENDING→CONVERTING | 409 "already being processed" | P0       |
| TC-CON-005 | Approve application X | Approve application Y | Simultaneous | Both succeed (independent)        | N/A                           | P1       |

### 3.3 Building Submit Race (M-03 Regression)

| ID         | Actor A Action    | Actor B Action           | Timing        | Expected Winner            | Expected Loser                           | Priority |
| :--------- | :---------------- | :----------------------- | :------------ | :------------------------- | :--------------------------------------- | :------- |
| TC-CON-006 | Submit building X | Submit building X        | Simultaneous  | First to claim WHERE guard | 409 "status has changed"                 | P0       |
| TC-CON-007 | Submit building X | Edit field on building X | A first by ms | A (ready_to_publish)       | B: field save succeeds but status locked | P1       |

### 3.4 DocuSign Webhook Race (H-11 Regression)

| ID         | Actor A Action  | Actor B Action         | Timing       | Expected Winner             | Expected Loser                 | Priority |
| :--------- | :-------------- | :--------------------- | :----------- | :-------------------------- | :----------------------------- | :------- |
| TC-CON-008 | Webhook: SIGNED | BD: cancel contract    | Simultaneous | Webhook (WHERE status=SENT) | Cancel fails (status mismatch) | P0       |
| TC-CON-009 | Webhook: SIGNED | Webhook: SIGNED (dupe) | Simultaneous | First to match WHERE        | Second is no-op                | P1       |

### 3.5 DocuSign Failure + Rollback Race

| ID         | Actor A Action                                        | Actor B Action        | Timing        | Expected Winner | Expected Loser                            | Priority |
| :--------- | :---------------------------------------------------- | :-------------------- | :------------ | :-------------- | :---------------------------------------- | :------- |
| TC-CON-010 | Confirm → DocuSign fails → rollback to PENDING_REVIEW | Confirm same contract | A claim first | A rolls back    | B blocked by WHERE guard during A's claim | P0       |

### 3.6 Optimistic Lock Race (M-02 + M-07 Regression)

| ID         | Actor A Action       | Actor B Action          | Timing         | Expected                                   | Priority |
| :--------- | :------------------- | :---------------------- | :------------- | :----------------------------------------- | :------- |
| TC-CON-011 | Edit field "name" v1 | Edit field "address" v1 | Simultaneous   | One succeeds, one gets 409 (stale version) | P1       |
| TC-CON-012 | Auto-save field v1   | Auto-save field v1      | Rapid debounce | Only latest save persists                  | P1       |

---

## 4. Authorization Test Matrix

### Roles

- **Supplier**: Authenticated user with `role=supplier`
- **BD**: Authenticated user with `role=bd`
- **Admin**: BD user whose email is in admin whitelist
- **Unauthenticated**: No session

### 4.1 Role x Resource x Action Matrix

| ID          | Role            | Resource                      | Action         | Expected         | Priority | Related Bugs |
| :---------- | :-------------- | :---------------------------- | :------------- | :--------------- | :------- | :----------- |
| TC-AUTH-001 | Unauthenticated | POST /api/apply               | Submit app     | 200 (public)     | P0       | C-02         |
| TC-AUTH-002 | Unauthenticated | GET /api/buildings/X          | Read building  | 401              | P0       | —            |
| TC-AUTH-003 | Unauthenticated | POST /api/admin/approve       | Approve        | 401              | P0       | —            |
| TC-AUTH-004 | Supplier        | GET own building              | Read           | 200              | P0       | —            |
| TC-AUTH-005 | Supplier        | GET other's building          | Read           | 404 (RLS)        | P0       | —            |
| TC-AUTH-006 | Supplier        | POST submit own building      | Submit         | 200              | P0       | —            |
| TC-AUTH-007 | Supplier        | POST submit other's bldg      | Submit         | 404 (RLS)        | P0       | —            |
| TC-AUTH-008 | Supplier        | POST /api/admin/approve       | Approve        | 403              | P0       | —            |
| TC-AUTH-009 | Supplier        | GET /api/admin/contracts      | List contracts | 403              | P1       | —            |
| TC-AUTH-010 | BD              | GET /api/admin/contracts      | List contracts | 200              | P0       | —            |
| TC-AUTH-011 | BD              | POST /api/admin/approve       | Approve        | 403 (admin only) | P0       | H-03         |
| TC-AUTH-012 | BD              | PUT contract (own scope)      | Edit contract  | 200              | P0       | H-04         |
| TC-AUTH-013 | BD              | PUT contract (other's)        | Edit contract  | 403 (scoping)    | P0       | H-04         |
| TC-AUTH-014 | BD              | PUT building status (own)     | Change status  | 200              | P1       | H-04         |
| TC-AUTH-015 | BD              | PUT building status (other's) | Change status  | 403 (scoping)    | P0       | H-04         |
| TC-AUTH-016 | Admin           | POST /api/admin/approve       | Approve        | 200              | P0       | H-03         |
| TC-AUTH-017 | Admin           | PUT any contract              | Edit           | 200              | P0       | —            |

### 4.2 Middleware Auth Edge Cases

| ID          | Scenario                                            | Expected                    | Priority | Related Bugs |
| :---------- | :-------------------------------------------------- | :-------------------------- | :------- | :----------- |
| TC-AUTH-018 | Rate limiter throws exception                       | Fail-closed (block request) | P0       | H-01         |
| TC-AUTH-019 | updateSession() throws exception                    | Fail-closed (block request) | P0       | H-01         |
| TC-AUTH-020 | Public route (/login) + middleware error            | Allow through (exempted)    | P0       | H-01         |
| TC-AUTH-021 | Public route (/api/apply) + middleware error        | Allow through (exempted)    | P0       | H-01         |
| TC-AUTH-022 | Webhook route (/api/webhooks/\*) + middleware error | Allow through               | P1       | H-01         |

### 4.3 Webhook Authentication

| ID          | Scenario                                     | Expected                 | Priority | Related Bugs |
| :---------- | :------------------------------------------- | :----------------------- | :------- | :----------- |
| TC-AUTH-023 | DocuSign webhook with valid HMAC             | 200, process event       | P0       | —            |
| TC-AUTH-024 | DocuSign webhook with invalid HMAC           | 401, reject              | P0       | —            |
| TC-AUTH-025 | DocuSign webhook with no signature           | 401, reject              | P0       | —            |
| TC-AUTH-026 | Extraction callback with valid service key   | 200                      | P1       | H-08         |
| TC-AUTH-027 | Extraction callback with invalid key         | 401                      | P1       | H-08         |
| TC-AUTH-028 | Timing attack on service key (>100 attempts) | Constant-time comparison | P1       | H-08         |

---

## 5. Data Validation Test Matrix

### 5.1 Application Form (/api/apply) — Server-Side Validation (C-02 Regression)

#### 5.1.1 Email Validation (Equivalence Partitioning)

| ID         | Input                                             | Partition             | Expected           | Priority |
| :--------- | :------------------------------------------------ | :-------------------- | :----------------- | :------- | ---- |
| TC-VAL-001 | `user@example.com`                                | Valid standard        | Accept             | P0       |
| TC-VAL-002 | `user@sub.domain.co.uk`                           | Valid subdomain       | Accept             | P1       |
| TC-VAL-003 | `not-an-email`                                    | Invalid: no @         | Reject             | P0       |
| TC-VAL-004 | `user@`                                           | Invalid: no domain    | Reject             | P0       |
| TC-VAL-005 | `USER@EXAMPLE.COM`                                | Case insensitive      | Normalize + Accept | P0       | M-08 |
| TC-VAL-006 | `  user@example.com  `                            | Whitespace            | Trim + Accept      | P0       | M-11 |
| TC-VAL-007 | `<script>@evil.com`                               | XSS payload           | Reject             | P0       | C-02 |
| TC-VAL-008 | `user@example.com` (exists)                       | Duplicate             | Reject 409         | P0       | M-08 |
| TC-VAL-009 | `User@Example.COM` (exists as `user@example.com`) | Case-insensitive dupe | Reject 409         | P0       | M-08 |

#### 5.1.2 Phone Validation (EP + BVA)

| ID         | Input                    | Partition          | Expected | Priority | Related Bugs |
| :--------- | :----------------------- | :----------------- | :------- | :------- | :----------- |
| TC-VAL-010 | `+1 (555) 123-4567`      | Valid US format    | Accept   | P0       | H-06         |
| TC-VAL-011 | `+44 20 7946 0958`       | Valid UK format    | Accept   | P1       | —            |
| TC-VAL-012 | `+54 11 1234-5678`       | Valid Argentina    | Accept   | P1       | H-07         |
| TC-VAL-013 | `abc123`                 | Invalid: letters   | Reject   | P0       | C-02         |
| TC-VAL-014 | `+1234567890123456`      | Invalid: too long  | Reject   | P1       | —            |
| TC-VAL-015 | `+1` (country code only) | Invalid: too short | Reject   | P1       | —            |

#### 5.1.3 URL Validation

| ID         | Input                 | Partition      | Expected | Priority | Related Bugs |
| :--------- | :-------------------- | :------------- | :------- | :------- | :----------- |
| TC-VAL-016 | `https://example.com` | Valid HTTPS    | Accept   | P0       | —            |
| TC-VAL-017 | `http://example.com`  | Valid HTTP     | Accept   | P1       | —            |
| TC-VAL-018 | `javascript:alert(1)` | XSS payload    | Reject   | P0       | C-02         |
| TC-VAL-019 | `not-a-url`           | Invalid format | Reject   | P0       | C-02         |
| TC-VAL-020 | (empty string)        | Optional field | Accept   | P2       | —            |

#### 5.1.4 Company Name Validation (BVA)

| ID         | Input                    | Partition    | Expected | Priority |
| :--------- | :----------------------- | :----------- | :------- | :------- | ---- |
| TC-VAL-021 | `A`                      | Min length   | Reject   | P1       |
| TC-VAL-022 | `AB`                     | Min boundary | Accept   | P1       |
| TC-VAL-023 | 200-char string          | Max boundary | Accept   | P2       |
| TC-VAL-024 | 201-char string          | Over max     | Reject   | P2       |
| TC-VAL-025 | `<img onerror=alert(1)>` | XSS payload  | Reject   | P0       | C-02 |

### 5.2 Contract Fields Validation

| ID         | Field               | Input                     | Expected             | Priority |
| :--------- | :------------------ | :------------------------ | :------------------- | :------- | --- |
| TC-VAL-026 | commission_rate     | `15%`                     | Accept               | P0       |
| TC-VAL-027 | commission_rate     | `-5%`                     | Reject               | P1       |
| TC-VAL-028 | contract_start_date | `2027-01-01`              | Accept               | P0       |
| TC-VAL-029 | contract_start_date | `not-a-date`              | Reject               | P1       |
| TC-VAL-030 | contract_end_date   | Before start_date         | Reject               | P0       |
| TC-VAL-031 | contract_fields     | null (confirm)            | 400 "fields missing" | P0       | —   |
| TC-VAL-032 | contract_type       | `EVIL_TYPE`               | Default to STANDARD  | P1       | —   |
| TC-VAL-033 | contract_type       | `STANDARD_PROMOTION_2026` | Accept               | P0       | —   |
| TC-VAL-034 | contract_type       | `PREMIUM_PROMOTION_2026`  | Accept               | P1       | —   |

### 5.3 Building Quality Score (BVA at 80 Threshold)

| ID         | Score | Expected Status Change | Priority | Technique        |
| :--------- | :---- | :--------------------- | :------- | :--------------- |
| TC-VAL-035 | 0     | incomplete             | P2       | BVA (min)        |
| TC-VAL-036 | 79    | incomplete             | P0       | BVA (boundary-1) |
| TC-VAL-037 | 80    | previewable            | P0       | BVA (boundary)   |
| TC-VAL-038 | 81    | previewable            | P1       | BVA (boundary+1) |
| TC-VAL-039 | 100   | previewable            | P2       | BVA (max)        |

### 5.4 Rate Limit Boundaries (BVA)

| ID         | Endpoint                | Request Count | Window | Expected                              | Priority | Related Bugs |
| :--------- | :---------------------- | :------------ | :----- | :------------------------------------ | :------- | :----------- |
| TC-VAL-040 | /api/apply              | 5             | 15 min | Last one: 200                         | P0       | —            |
| TC-VAL-041 | /api/apply              | 6             | 15 min | 6th: 429                              | P0       | —            |
| TC-VAL-042 | /login                  | 3             | 5 min  | Last one: 200                         | P0       | —            |
| TC-VAL-043 | /login                  | 4             | 5 min  | 4th: 429                              | P0       | —            |
| TC-VAL-044 | /api/buildings/X/fields | 60            | 1 min  | Last one: 200                         | P1       | —            |
| TC-VAL-045 | /api/buildings/X/fields | 61            | 1 min  | 61st: 429                             | P1       | —            |
| TC-VAL-046 | /api/webhooks/X         | 100           | 1 min  | Last one: 200                         | P1       | —            |
| TC-VAL-047 | /api/webhooks/X         | 101           | 1 min  | 101st: 429                            | P1       | —            |
| TC-VAL-048 | Any API (default)       | 120           | 1 min  | Last one: 200                         | P2       | —            |
| TC-VAL-049 | Any API (default)       | 121           | 1 min  | 121st: 429                            | P2       | —            |
| TC-VAL-050 | /api/apply (NAT)        | 5 from IP-A   | 15 min | 5th blocked                           | P1       | M-01         |
| TC-VAL-051 | Rate limit headers      | Any 200       | N/A    | X-RateLimit-Limit + Remaining present | P2       | —            |
| TC-VAL-052 | 429 response            | Over limit    | N/A    | Retry-After header present            | P1       | —            |

### 5.5 Phone Country Code Resolution (H-06 Regression)

| ID         | Stored Code | Expected Country | Priority | Related Bugs |
| :--------- | :---------- | :--------------- | :------- | :----------- |
| TC-VAL-053 | +1          | US (not Canada)  | P0       | H-06         |
| TC-VAL-054 | +1 (CA)     | Canada           | P0       | H-06         |
| TC-VAL-055 | +44         | UK               | P1       | —            |
| TC-VAL-056 | +54         | Argentina        | P1       | H-07         |

### 5.6 Currency Support (EP)

| ID         | Currency Group     | Expected  | Priority | Related Bugs |
| :--------- | :----------------- | :-------- | :------- | :----------- |
| TC-VAL-057 | USD, CAD, GBP, EUR | Available | P0       | —            |
| TC-VAL-058 | AUD, JPY, CNY      | Available | P0       | —            |
| TC-VAL-059 | AED, SAR, TRY, PLN | Available | P0       | H-12         |
| TC-VAL-060 | BRL, MXN           | Available | P1       | H-12         |

---

## 6. Compliance Test Matrix

### 6.1 Cookie Consent (GDPR ePrivacy)

#### 6.1.1 Consent Defaults by Region (EP)

| ID          | Country Code | Functional Default | Analytics Default | Priority | Related Bugs |
| :---------- | :----------- | :----------------- | :---------------- | :------- | :----------- |
| TC-COMP-001 | DE (EU)      | OFF                | OFF               | P0       | M-05         |
| TC-COMP-002 | GB (UK)      | OFF                | OFF               | P0       | M-05         |
| TC-COMP-003 | FR (EU)      | OFF                | OFF               | P1       | M-05         |
| TC-COMP-004 | US           | ON                 | OFF               | P0       | —            |
| TC-COMP-005 | AU           | ON                 | OFF               | P1       | —            |
| TC-COMP-006 | (undefined)  | ON                 | OFF               | P1       | M-05         |
| TC-COMP-007 | CH (EEA)     | OFF                | OFF               | P2       | —            |
| TC-COMP-008 | NO (EEA)     | OFF                | OFF               | P2       | —            |

#### 6.1.2 Consent Banner Behavior

| ID          | Scenario                       | Expected                         | Priority | Related Bugs |
| :---------- | :----------------------------- | :------------------------------- | :------- | :----------- |
| TC-COMP-009 | First visit, no consent stored | Banner shown                     | P0       | —            |
| TC-COMP-010 | User clicks "Accept All"       | All categories ON, banner hidden | P0       | —            |
| TC-COMP-011 | User clicks "Reject Optional"  | Only necessary ON, banner hidden | P0       | —            |
| TC-COMP-012 | Return visit, consent stored   | Banner NOT shown                 | P1       | —            |
| TC-COMP-013 | Necessary cookies always ON    | Cannot be toggled OFF            | P0       | —            |

#### 6.1.3 Analytics Consent Gating (H-05 + M-06 Regression)

| ID          | Scenario                         | Expected                        | Priority | Related Bugs |
| :---------- | :------------------------------- | :------------------------------ | :------- | :----------- |
| TC-COMP-014 | PostHog init before consent      | NO cookies/localStorage set     | P0       | H-05         |
| TC-COMP-015 | PostHog init after analytics=ON  | Cookies set, tracking active    | P0       | H-05         |
| TC-COMP-016 | Analytics consent revoked        | PostHog cookies cleared         | P0       | H-05         |
| TC-COMP-017 | Sentry replay before consent     | No session replay captured      | P0       | M-06         |
| TC-COMP-018 | Sentry replay after analytics=ON | Session replay active on errors | P1       | M-06         |
| TC-COMP-019 | trackEvent() without consent     | Event NOT sent to PostHog       | P0       | H-05         |
| TC-COMP-020 | identifyUser() without consent   | Identification NOT sent         | P0       | H-05         |

### 6.2 GDPR Data Export (Article 20 — Right to Data Portability)

| ID          | Table/Data Source              | Included in Export       | Priority | Related Bugs |
| :---------- | :----------------------------- | :----------------------- | :------- | :----------- |
| TC-COMP-021 | suppliers                      | Yes                      | P0       | —            |
| TC-COMP-022 | buildings                      | Yes                      | P0       | —            |
| TC-COMP-023 | contracts                      | Yes                      | P0       | —            |
| TC-COMP-024 | applications                   | Yes                      | P0       | —            |
| TC-COMP-025 | building_onboarding_data       | Yes                      | P0       | C-03         |
| TC-COMP-026 | field_audit_logs               | Yes                      | P0       | C-03         |
| TC-COMP-027 | extraction_jobs                | Yes                      | P0       | C-03         |
| TC-COMP-028 | Auth metadata (email, created) | Yes                      | P1       | C-03         |
| TC-COMP-029 | Internal fields (bd_user_id)   | Redacted                 | P1       | C-03         |
| TC-COMP-030 | Export format                  | Valid JSON, downloadable | P1       | —            |

### 6.3 Account Deletion (Article 17 — Right to Erasure)

#### 6.3.1 Deletion Eligibility Pre-Checks

| ID          | Condition                                   | Expected                         | Priority | Related Bugs |
| :---------- | :------------------------------------------ | :------------------------------- | :------- | :----------- |
| TC-COMP-031 | No published buildings, no active contracts | canDelete: true                  | P0       | —            |
| TC-COMP-032 | 1 published building                        | canDelete: false, blocker listed | P0       | —            |
| TC-COMP-033 | Contract in DRAFT status                    | canDelete: false, blocker listed | P0       | M-04         |
| TC-COMP-034 | Contract in PENDING_REVIEW                  | canDelete: false, blocker listed | P0       | M-04         |
| TC-COMP-035 | Contract in CONFIRMED                       | canDelete: false, blocker listed | P0       | M-04         |
| TC-COMP-036 | Contract in SENT                            | canDelete: false, blocker listed | P0       | M-04         |
| TC-COMP-037 | Contract in SIGNED only                     | canDelete: true                  | P1       | —            |
| TC-COMP-038 | Contract in CANCELED only                   | canDelete: true                  | P1       | —            |

#### 6.3.2 Deletion Cooling Period

| ID          | Scenario                                              | Expected                                                 | Priority | Related Bugs |
| :---------- | :---------------------------------------------------- | :------------------------------------------------------- | :------- | :----------- |
| TC-COMP-039 | Mark for deletion                                     | Status=DELETION_PENDING, deletion_scheduled_at = now+30d | P0       | M-10         |
| TC-COMP-040 | Cancel deletion within 30 days                        | Status reverts, deletion_scheduled_at cleared            | P0       | —            |
| TC-COMP-041 | Deletion_scheduled_at persists across server restarts | Column in DB                                             | P1       | M-10         |

#### 6.3.3 Deletion Execution

| ID          | Data Target                        | Expected Action                           | Priority | Related Bugs |
| :---------- | :--------------------------------- | :---------------------------------------- | :------- | :----------- |
| TC-COMP-042 | Storage: signed-contracts bucket   | Files deleted                             | P0       | H-13         |
| TC-COMP-043 | Storage: uploaded-contracts bucket | Files deleted                             | P0       | H-13         |
| TC-COMP-044 | buildings table                    | Rows deleted                              | P0       | —            |
| TC-COMP-045 | building_onboarding_data           | Cascade-deleted via FK                    | P0       | —            |
| TC-COMP-046 | field_audit_logs                   | Cascade-deleted via FK                    | P0       | —            |
| TC-COMP-047 | extraction_jobs                    | Cascade-deleted via FK                    | P0       | —            |
| TC-COMP-048 | contracts                          | document_url + signature_fields nullified | P0       | —            |
| TC-COMP-049 | applications                       | Rows deleted by email match               | P0       | —            |
| TC-COMP-050 | suppliers                          | Row deleted                               | P0       | —            |
| TC-COMP-051 | AU supplier (Australia)            | Anonymized instead of deleted             | P1       | —            |

### 6.4 Signed Contract Storage Security (H-09 Regression)

| ID          | Scenario                        | Expected                             | Priority | Related Bugs |
| :---------- | :------------------------------ | :----------------------------------- | :------- | :----------- |
| TC-COMP-052 | New signed contract stored      | Private bucket, path-only URL stored | P0       | H-09         |
| TC-COMP-053 | Supplier requests own contract  | Signed URL generated, time-limited   | P0       | H-09         |
| TC-COMP-054 | Unauthenticated access to path  | 403 Forbidden                        | P0       | H-09         |
| TC-COMP-055 | Old public URLs (pre-migration) | Inaccessible after bucket ACL change | P0       | H-09         |

---

## 7. Approval Flow Integration Tests

End-to-end scenarios for the supplier approval pipeline.

| ID         | Scenario                                             | Expected                                               | Priority | Related Bugs |
| :--------- | :--------------------------------------------------- | :----------------------------------------------------- | :------- | :----------- |
| TC-INT-001 | Happy path: apply → approve → contract DRAFT created | Supplier created, auth user invited, contract in DRAFT | P0       | C-05         |
| TC-INT-002 | Approval with existing auth user (pre-OTP)           | Reuse existing auth user, no duplicate                 | P1       | —            |
| TC-INT-003 | Approval fails at supplier insert → rollback         | Auth user deleted, application reset to PENDING        | P0       | C-05         |
| TC-INT-004 | Approval fails at contract insert → rollback         | Supplier + auth user deleted, application reset        | P0       | C-05         |
| TC-INT-005 | Application with duplicate email                     | 409, supplier already exists                           | P0       | —            |
| TC-INT-006 | Invalid contract_type in payload                     | Defaults to STANDARD_PROMOTION_2026                    | P1       | —            |
| TC-INT-007 | Application stuck in CONVERTING (stale)              | Cleanup mechanism returns to PENDING                   | P1       | —            |

---

## 8. Coverage Summary

| Matrix                      | Test Cases | P0      | P1     | P2     |
| :-------------------------- | :--------- | :------ | :----- | :----- |
| Contract State Machine      | 34         | 10      | 18     | 6      |
| Building State Machine      | 21         | 8       | 8      | 5      |
| Concurrency                 | 12         | 7       | 5      | 0      |
| Authorization               | 28         | 17      | 9      | 2      |
| Data Validation             | 60         | 28      | 22     | 10     |
| Compliance                  | 55         | 38      | 14     | 3      |
| Integration (Approval Flow) | 7          | 4       | 3      | 0      |
| **Total**                   | **217**    | **112** | **79** | **26** |

### Bug Regression Coverage

All 32 bugs from `BUG_REPORT_100_SUPPLIERS.md` are covered by at least one test case:

| Bug ID  | Test Cases Covering It                                     |
| :------ | :--------------------------------------------------------- |
| C-01    | TC-CSM-003, TC-CSM-006, TC-CSM-008, TC-CON-010             |
| C-02    | TC-AUTH-001, TC-VAL-001–025                                |
| C-03    | TC-COMP-021–030                                            |
| C-05    | TC-CON-004, TC-CON-005, TC-INT-001, TC-INT-003, TC-INT-004 |
| H-01    | TC-AUTH-018–022                                            |
| H-02    | TC-CON-001–003                                             |
| H-03    | TC-AUTH-011, TC-AUTH-016                                   |
| H-04    | TC-AUTH-012–015                                            |
| H-05    | TC-COMP-014–016, TC-COMP-019–020                           |
| H-06    | TC-VAL-053–054                                             |
| H-07    | TC-VAL-056                                                 |
| H-08    | TC-AUTH-026–028                                            |
| H-09    | TC-COMP-052–055                                            |
| H-10    | (UI-level, not in API test matrix — needs E2E)             |
| H-11    | TC-CON-008–009                                             |
| H-12    | TC-VAL-057–060                                             |
| H-13    | TC-COMP-042–043                                            |
| M-01    | TC-VAL-050                                                 |
| M-02    | TC-CON-011–012                                             |
| M-03    | TC-CON-006–007                                             |
| M-04    | TC-COMP-033–036                                            |
| M-05    | TC-COMP-001–008                                            |
| M-06    | TC-COMP-017–018                                            |
| M-07    | TC-CON-011                                                 |
| M-08    | TC-VAL-005, TC-VAL-008–009                                 |
| M-09    | (RLS policy — needs Supabase Dashboard verification)       |
| M-10    | TC-COMP-039–041                                            |
| M-11    | TC-VAL-006                                                 |
| L-01–04 | UI-level — need E2E or manual tests                        |

---

## 9. Testing Techniques Applied

| Technique                 | Where Applied                                                                          | Case Count |
| :------------------------ | :------------------------------------------------------------------------------------- | :--------- |
| State Transition Coverage | Contract SM (2.1), Building SM (2.2)                                                   | 55         |
| Boundary Value Analysis   | Score threshold (5.3), Rate limits (5.4), Field lengths (5.1.4)                        | 30         |
| Equivalence Partitioning  | Email/phone/URL formats (5.1), Currencies (5.6), Countries (6.1)                       | 40         |
| Pairwise Combinatorial    | Role x Resource x Action (4.1) — 4 roles x 8 resources x 3 actions reduced to 17 cases | 17         |
| Concurrency Matrix        | Actor A x Actor B x Timing (3.1–3.6)                                                   | 12         |

---

## 10. Out of Scope (Requires E2E / Manual Testing)

These items cannot be covered by unit/integration tests and need separate E2E or manual test plans:

1. **H-10**: Login `router.refresh()` redirect behavior — requires browser E2E
2. **L-01**: Phone code search in non-English — requires UI interaction
3. **L-02**: Country field free text normalization — UI-level
4. **L-03**: Auto-provisioned BD account naming — requires Supabase auth hook
5. **L-04**: PhoneInput error border color — visual regression test
6. **M-09**: RLS INSERT policy — requires Supabase Dashboard verification
7. **H-09 migration**: Existing public URL migration — one-time operational task

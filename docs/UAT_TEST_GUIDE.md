# UAT Test Guide — uhomes Supplier Onboarding Platform

> **Version:** 1.0 | **Date:** 2026-02-26
>
> **Production URL:** https://on-uhomes-com-onboarding-web.vercel.app

This guide contains step-by-step test scenarios for the uhomes Supplier Onboarding Platform. Tests are divided into two sections based on user role.

**Before you begin:** You will need access to your work email inbox to receive OTP verification codes.

---

## Part A: BD (Business Development) Test Flow

**Test accounts:** Use your `@uhomes.com` email address.

After login, you will be redirected to the Admin panel automatically.

---

### BD-01: Login with OTP

| Step | Action                                                        | Expected Result                                                                           |
| ---- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1    | Open https://on-uhomes-com-onboarding-web.vercel.app/login    | See "Welcome to uhomes.com" heading, email input field, and "Continue with Email" button  |
| 2    | Leave email empty, click **Continue with Email**              | Error message: "Please enter a valid email address"                                       |
| 3    | Enter your `@uhomes.com` email, click **Continue with Email** | Page transitions to OTP step. You see "We've sent an 8-digit secure code to [your email]" |
| 4    | Check your email inbox                                        | You should receive an email with an 8-digit verification code                             |
| 5    | Enter only 4 digits in the code field                         | **Secure Login** button remains disabled                                                  |
| 6    | Enter the full 8-digit code, click **Secure Login**           | Button text changes to "Verified", then you are redirected to `/admin/suppliers`          |

---

### BD-02: View My Suppliers

| Step | Action                                        | Expected Result                                                                             |
| ---- | --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1    | After login, you should be on the Admin panel | Left sidebar shows: **My Suppliers**, **Invite Supplier**. Header shows "BD" role indicator |
| 2    | Click **My Suppliers** in the sidebar         | See a list of suppliers assigned to you (may be empty initially)                            |
| 3    | If suppliers exist, verify each row shows     | Company name, Email, Status badge, Buildings count, Created date                            |
| 4    | Note the status badges                        | **New** (gray), **Pending Contract** (yellow), **Signed** (green)                           |

---

### BD-03: Invite a New Supplier

| Step | Action                                                                         | Expected Result                                                                              |
| ---- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| 1    | Click **Invite Supplier** in the sidebar                                       | See invitation form with fields: Email, Company Name, Phone, City, Website                   |
| 2    | Leave all fields empty, click **Send Invitation**                              | Error messages appear for Email and Company Name (required fields)                           |
| 3    | Fill in: Email = `testpartner@example.com`, Company Name = `Test Property LLC` | No errors on these fields                                                                    |
| 4    | Optionally fill in Phone, City, Website                                        | These are optional — form accepts empty values                                               |
| 5    | Click **Send Invitation**                                                      | Button shows "Sending...", then success message: "Invitation sent successfully". Form resets |
| 6    | Go back to **My Suppliers**                                                    | The newly invited supplier should appear in your list with status **New**                    |

---

### BD-04: View Supplier Detail

| Step | Action                                          | Expected Result                                                                 |
| ---- | ----------------------------------------------- | ------------------------------------------------------------------------------- |
| 1    | From the supplier list, click on a supplier row | Navigate to supplier detail page. See "Back to Suppliers" link at top           |
| 2    | Verify the supplier info card                   | Shows: Company name, Status badge, Email, Created date, Assigned BD (your name) |
| 3    | Check the **Buildings** section                 | Shows a table of buildings (or "No buildings associated with this supplier")    |
| 4    | Check the **Contracts** section                 | Shows a table of contracts (or "No contracts yet")                              |

---

### BD-05: Edit a Draft Contract

> This test requires a supplier with a contract in **DRAFT** status. If none exists, ask your admin to approve a supplier application first.

| Step | Action                                                      | Expected Result                                                                                                                                                             |
| ---- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | From supplier detail, find a contract with **DRAFT** status | You should see an "Edit Contract" link in the Action column                                                                                                                 |
| 2    | Click **Edit Contract**                                     | Navigate to contract edit page. See 9 form fields, **Save** and **Push for Review** buttons                                                                                 |
| 3    | Verify the 9 fields are present and editable                | Partner Company Name, Partner Contact Name, Partner Address, Partner City, Partner Country, Commission Rate (%), Contract Start Date, Contract End Date, Covered Properties |
| 4    | Check auto-prefill                                          | Partner Company Name and Partner City may be auto-filled from the supplier's application data                                                                               |
| 5    | Edit **Partner Contact Name** to "Test Contact"             | Field accepts input normally                                                                                                                                                |
| 6    | Set **Commission Rate** to `15`                             | Field accepts numeric input                                                                                                                                                 |
| 7    | Set **Contract Start Date** to today's date                 | Date picker works correctly                                                                                                                                                 |
| 8    | Set **Contract End Date** to one year from today            | Date picker works correctly                                                                                                                                                 |
| 9    | Click **Save**                                              | Button shows "Saving...", then success message: "Contract fields saved". Fields retain their values                                                                         |
| 10   | Click **Push for Review**                                   | Saves first, then shows "Contract pushed for review". Save and Push buttons disappear (contract is no longer DRAFT)                                                         |
| 11   | Click **Back to Supplier**                                  | Contract status in the table should now show **PENDING_REVIEW**                                                                                                             |

---

### BD-06: Verify Read-Only Mode for Non-Draft Contracts

| Step | Action                                                                                                 | Expected Result                                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| 1    | From supplier detail, find a contract that is NOT in DRAFT status (e.g., PENDING_REVIEW, SENT, SIGNED) | No "Edit Contract" link, or if you navigate to the edit URL directly...                                       |
| 2    | If you can access the edit page                                                                        | All 9 fields are disabled (grayed out). No Save or Push buttons visible. A message says "editing is disabled" |

---

### BD-07: Resend Signing Email

> Requires a contract in **SENT** status.

| Step | Action                                                     | Expected Result                                                        |
| ---- | ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1    | From supplier detail, find a contract with **SENT** status | You should see a "Resend" button in the Action column                  |
| 2    | Click **Resend**                                           | Button shows loading state, then confirms the signing email was resent |

---

### BD-08: Logout

| Step | Action                                         | Expected Result                                                                                   |
| ---- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1    | Click the **Logout** button (top-right corner) | You are redirected to `/login`. Attempting to visit `/admin/suppliers` redirects back to `/login` |

---

## Part B: Supplier Test Flow

**Test accounts:** Suppliers log in using the email they registered with (either via the landing page form or via BD invitation).

After login, suppliers are redirected to their Dashboard.

---

### SUP-01: Submit an Application (Public — No Login Required)

| Step | Action                                                                                                                                                                 | Expected Result                                                                                                                                                   |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Open https://on-uhomes-com-onboarding-web.vercel.app                                                                                                                   | See landing page with "Unlock Millions of Global Students" heading and "Become a Supplier" form on the right                                                      |
| 2    | Verify the navigation bar                                                                                                                                              | Top-right shows "Supplier Sign In" link                                                                                                                           |
| 3    | Click **Submit Request** with all fields empty                                                                                                                         | Validation errors appear: "Company Name is required", "Valid work email is required", "Valid phone number is required", "City is required", "Country is required" |
| 4    | Fill in Company Name = `My Test Property`                                                                                                                              | Error for Company Name disappears                                                                                                                                 |
| 5    | Enter an invalid email (e.g., `abc`) and submit                                                                                                                        | Error: "Valid work email is required"                                                                                                                             |
| 6    | Fill all required fields correctly: Company = `My Test Property`, Email = `your-email@example.com`, Phone = `+1 555 1234`, City = `London`, Country = `United Kingdom` | No errors visible                                                                                                                                                 |
| 7    | Leave **Website URL** empty (it is optional)                                                                                                                           | No error for this field                                                                                                                                           |
| 8    | Click **Submit Request**                                                                                                                                               | Button shows loading spinner. Then you see: "Application Received!" with a success message                                                                        |
| 9    | Click **Submit another application**                                                                                                                                   | Form resets to empty. You can submit again                                                                                                                        |

---

### SUP-02: Navigate to Login from Landing Page

| Step | Action                                                      | Expected Result           |
| ---- | ----------------------------------------------------------- | ------------------------- |
| 1    | On the landing page, click **Supplier Sign In** (top-right) | Navigate to `/login` page |

---

### SUP-03: Supplier Login with OTP

| Step | Action                                                              | Expected Result                                           |
| ---- | ------------------------------------------------------------------- | --------------------------------------------------------- |
| 1    | Open https://on-uhomes-com-onboarding-web.vercel.app/login          | See "Welcome to uhomes.com" with email input              |
| 2    | Enter your registered supplier email, click **Continue with Email** | Transitions to OTP step. Message shows your email address |
| 3    | Click **Use a different email address**                             | Returns to email input step                               |
| 4    | Re-enter email, click **Continue with Email** again                 | Back to OTP step                                          |
| 5    | Check your email for the 8-digit code                               | Code received in inbox                                    |
| 6    | Enter the code, click **Secure Login**                              | "Verified" shown, then redirected to `/dashboard`         |

---

### SUP-04: View Dashboard — Pending Contract

> This scenario applies when your contract is being prepared by the BD team.

| Step | Action                               | Expected Result                                                                                                                                                                            |
| ---- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | After login, you are on `/dashboard` | See "Welcome, [Your Company Name]" header with your email and a Logout button                                                                                                              |
| 2    | If contract is in **DRAFT**          | You see: "Contract is Being Prepared" with a clock icon. No action buttons — wait for BD team                                                                                              |
| 3    | If contract is in **PENDING_REVIEW** | You see all contract details displayed (company name, contact, address, city, country, commission rate, dates, properties). Two buttons appear: **Confirm & Sign** and **Request Changes** |

---

### SUP-05: Review and Sign Contract

> Requires your contract to be in **PENDING_REVIEW** status.

| Step | Action                                                | Expected Result                                                                                                                                                                 |
| ---- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | On dashboard, review the contract fields displayed    | Verify: Partner Company Name, Partner Contact Name, Partner Address, Partner City, Partner Country, Commission Rate, Contract Start Date, Contract End Date, Covered Properties |
| 2    | If everything looks correct, click **Confirm & Sign** | Button shows loading. Message: "Creating Signing Request..."                                                                                                                    |
| 3    | Wait a moment                                         | Status changes to "Signing Email Sent — Check Your Inbox" with a mail icon                                                                                                      |
| 4    | Check your email                                      | You should receive a DocuSign signing email with a link                                                                                                                         |
| 5    | Click the signing link in the email                   | Opens DocuSign. Follow the instructions to sign the contract                                                                                                                    |
| 6    | After signing, return to dashboard and refresh        | Status shows "Contract Signed Successfully" with a green checkmark                                                                                                              |
| 7    | If a download button appears                          | Click **Download Signed Contract (PDF)** to download the signed document                                                                                                        |

---

### SUP-06: Resend Signing Email

> Requires contract in **SENT** status (after clicking Confirm & Sign but before completing DocuSign).

| Step | Action                                            | Expected Result                                          |
| ---- | ------------------------------------------------- | -------------------------------------------------------- |
| 1    | On dashboard, contract shows "Signing Email Sent" | A **Resend Signing Email** button is visible             |
| 2    | Click **Resend Signing Email**                    | Button shows loading, then confirms the email was resent |
| 3    | Check your inbox                                  | A new signing email arrives                              |

---

### SUP-07: View Buildings (After Contract Signed)

> Requires contract in **SIGNED** status with buildings assigned.

| Step | Action                                                 | Expected Result                                                                 |
| ---- | ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| 1    | On dashboard, you should see "Your Properties" section | Building cards appear in a grid layout                                          |
| 2    | Each card shows                                        | Building name, Address, Status badge, Completion score bar, Missing field count |
| 3    | Note the status badges                                 | **extracting** (gray), **incomplete** (yellow), **previewable** (green)         |
| 4    | Click on a building card                               | Navigate to `/onboarding/[buildingId]` — the building detail form               |

---

### SUP-08: Fill Building Onboarding Form

> Requires a building in **incomplete** status.

| Step | Action                                                  | Expected Result                                                                                                                                                |
| ---- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Open a building from your dashboard                     | See building name at top, status badge, and a score bar showing completion progress                                                                            |
| 2    | See the field groups on the left                        | Groups include: Basic Info, Commission, Contacts, Availability, Booking Process, Lease Policy, Tenant Qualification, Building Details, Fees, Furnishing & Room |
| 3    | Click on a field group to expand it                     | Fields are displayed with labels and input areas                                                                                                               |
| 4    | Fill in a text field (e.g., Building Name)              | After a short delay (~1 second), you should see a brief "saving" indicator. The field auto-saves                                                               |
| 5    | Check the right panel (desktop) or scroll down (mobile) | Gap Report shows remaining missing fields and their priority                                                                                                   |
| 6    | Fill in several more required fields                    | Score bar updates, missing field count decreases                                                                                                               |
| 7    | After completing all required fields                    | Status badge changes to **previewable** (green). A **Submit for Review** button appears                                                                        |
| 8    | Click **Submit for Review**                             | Building status changes to **ready_to_publish**. Submit button disappears                                                                                      |

---

### SUP-09: Auth Protection — Cannot Access Admin Pages

| Step | Action                                                                 | Expected Result                                                          |
| ---- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1    | While logged in as a supplier, manually navigate to `/admin/suppliers` | You are redirected to `/dashboard` (suppliers cannot access admin pages) |

---

### SUP-10: Logout

| Step | Action                                              | Expected Result                                                         |
| ---- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| 1    | Click the **Logout** button on the dashboard header | Redirected to `/login`. Visiting `/dashboard` now redirects to `/login` |

---

## Quick Reference: Test Account Setup

| Role     | How to Get Access                                                                                                                                     |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| BD       | Your `@uhomes.com` email has been pre-configured. Go to `/login` and enter your email                                                                 |
| Supplier | Either submit an application on the landing page, or ask a BD to invite you via the Invite Supplier form. Then log in at `/login` with the same email |

## Status Flow Reference

```
Application:   PENDING  ──→  CONVERTED  (or REJECTED)
                                │
Contract:              DRAFT ──→ PENDING_REVIEW ──→ CONFIRMED ──→ SENT ──→ SIGNED
                                                                            │
Building:                                               extracting ──→ incomplete ──→ previewable ──→ ready_to_publish ──→ published
```

---

## Reporting Issues

If you encounter any bugs or unexpected behavior during testing, please report them with:

1. **Your email address** (so we can check your account)
2. **The page URL** where the issue occurred
3. **What you did** (step-by-step)
4. **What you expected** to happen
5. **What actually happened** (screenshot if possible)

Send reports to: ning.ding@uhomes.com

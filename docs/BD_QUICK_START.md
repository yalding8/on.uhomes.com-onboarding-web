# BD Quick Start Guide — uhomes Supplier Onboarding Platform

> **URL:** https://on-uhomes-com-onboarding-web.vercel.app

---

## How to Log In

1. Go to https://on-uhomes-com-onboarding-web.vercel.app/login
2. Enter your `@uhomes.com` email address
3. Click **Continue with Email**
4. Check your inbox for an 8-digit verification code
5. Enter the code and click **Secure Login**
6. You will be redirected to the Admin panel

---

## What You Can Do

### 1. View Your Suppliers

After login, click **My Suppliers** in the sidebar. Here you can see all suppliers assigned to you, including their company name, email, status, and number of buildings.

Click on any supplier to view their full details — buildings, contracts, and assigned BD info.

### 2. Invite a New Supplier

Click **Invite Supplier** in the sidebar. Fill in the supplier's email and company name (required), plus optional phone, city, and website. The supplier will receive an invitation and can log in to start the onboarding process.

### 3. Edit & Send Contracts

From a supplier's detail page, find contracts in **DRAFT** status and click **Edit Contract**. You can fill in 9 contract fields:

- Partner Company Name, Contact Name, Address, City, Country
- Commission Rate (%)
- Contract Start & End Date
- Covered Properties

Click **Save** to save your progress, or **Push for Review** to send the contract to the supplier for confirmation and signing.

### 4. Track Contract Status

Contracts go through these stages:

| Status             | Meaning                                              |
| ------------------ | ---------------------------------------------------- |
| **DRAFT**          | You are editing — supplier cannot see it yet         |
| **PENDING_REVIEW** | Sent to supplier — waiting for their confirmation    |
| **CONFIRMED**      | Supplier confirmed — DocuSign envelope being created |
| **SENT**           | Signing email sent to supplier                       |
| **SIGNED**         | Contract signed — done!                              |

### 5. Resend Signing Email

If a contract is in **SENT** status and the supplier hasn't received the email, click **Resend** from the supplier detail page.

---

## What the Supplier Experiences

For context, here's what happens on the supplier side:

1. **Application** — Supplier submits a form on the public landing page (or gets invited by you)
2. **Login** — Supplier logs in with OTP, same as you
3. **Contract Review** — Supplier sees the contract you pushed, clicks **Confirm & Sign**
4. **E-Signature** — Supplier receives a DocuSign email and signs electronically
5. **Building Onboarding** — After signing, supplier fills in property details for each building

---

## Tips

- You can only see suppliers **assigned to you** — if you need access to others, ask your admin
- Contracts can only be edited in **DRAFT** status — once pushed, they become read-only for you
- The platform works on both desktop and mobile

---

If you have any questions or run into issues, contact: ning.ding@uhomes.com

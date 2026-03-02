/**
 * 邀请供应商页面 — Server Component 容器
 *
 * Requirements: 8.1
 */

import { InviteForm } from "@/components/admin/InviteForm";

export default function InvitePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">
        Invite Supplier
      </h1>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        Send an onboarding invitation to a new property partner.
      </p>
      <InviteForm />
    </div>
  );
}

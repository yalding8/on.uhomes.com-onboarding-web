/**
 * 邀请供应商页面 — Server Component 容器
 *
 * Requirements: 8.1
 */

import { InviteForm } from "@/components/admin/InviteForm";

export default function InvitePage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-6">
        邀请供应商
      </h1>
      <InviteForm />
    </div>
  );
}

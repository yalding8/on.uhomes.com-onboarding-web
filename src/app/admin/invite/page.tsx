/**
 * Invite Supplier page — two-column layout with flow steps and tips.
 */

import { UserPlus } from "lucide-react";
import { InviteForm } from "@/components/admin/InviteForm";
import { InviteFlowSteps } from "@/components/admin/InviteFlowSteps";
import { InviteTips } from "@/components/admin/InviteTips";

export default function InvitePage() {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary-light)]">
          <UserPlus className="h-4 w-4 text-[var(--color-primary)]" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          Invite Supplier
        </h1>
      </div>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6 ps-[42px]">
        Send an onboarding invitation to a new property partner.
      </p>

      {/* Flow Steps */}
      <InviteFlowSteps />

      {/* Two-column: Form + Tips */}
      <div className="grid grid-cols-1 md:grid-cols-5 lg:grid-cols-3 gap-6">
        <div className="md:col-span-3 lg:col-span-2">
          <InviteForm />
        </div>
        <div className="md:col-span-2 lg:col-span-1">
          <InviteTips />
        </div>
      </div>
    </div>
  );
}

/**
 * Success card shown after a supplier invitation is sent.
 * Displays confirmation details and next-step CTAs.
 */

import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";

interface InviteSuccessCardProps {
  company: string;
  email: string;
  onInviteAnother: () => void;
}

export function InviteSuccessCard({
  company,
  email,
  onInviteAnother,
}: InviteSuccessCardProps) {
  return (
    <div
      role="status"
      className="rounded-xl border border-[var(--color-success)] bg-[var(--color-success-light)] p-6 text-center"
    >
      <CheckCircle2 className="h-10 w-10 text-[var(--color-success)] mx-auto mb-3" />
      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
        Invitation Sent!
      </h3>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        <span className="font-medium text-[var(--color-text-primary)]">
          {company}
        </span>{" "}
        will receive an email at{" "}
        <span className="font-medium text-[var(--color-text-primary)]">
          {email}
        </span>{" "}
        shortly.
      </p>
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={onInviteAnother}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] transition-all"
        >
          Invite Another
        </button>
        <Link
          href="/admin/suppliers"
          className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors"
        >
          View Suppliers
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

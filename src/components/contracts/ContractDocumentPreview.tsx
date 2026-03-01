/**
 * Formatted contract document preview.
 *
 * Renders the 9 contract fields as a professional agreement document,
 * shared by both BD (edit page preview) and Supplier (PENDING_REVIEW).
 */

import { FileText } from "lucide-react";
import type { ContractFields } from "@/lib/contracts/types";

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <span className="font-semibold text-[var(--color-text-primary)]">
      {value || (
        <span className="text-[var(--color-text-muted)] italic font-normal">
          Not specified
        </span>
      )}
    </span>
  );
}

export function ContractDocumentPreview({
  fields,
}: {
  fields: Partial<ContractFields> | null;
}) {
  if (!fields) {
    return (
      <div className="flex flex-col items-center py-12 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] mb-4">
          <FileText className="h-7 w-7 text-[var(--color-text-muted)]" />
        </div>
        <h4 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
          Contract Not Yet Available
        </h4>
        <p className="text-sm text-[var(--color-text-secondary)] max-w-xs">
          The contract details are being prepared. You will see the full
          agreement here once your BD manager completes the setup.
        </p>
      </div>
    );
  }

  const f = fields;

  return (
    <div className="border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)] overflow-hidden">
      {/* Document Header */}
      <div className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] px-6 py-5 text-center">
        <div className="inline-flex items-center gap-2 text-[var(--color-text-muted)] text-xs uppercase tracking-wider mb-2">
          <FileText className="w-4 h-4" />
          Standard Promotion Agreement
        </div>
        <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
          uhomes.com Partnership Agreement 2026
        </h3>
      </div>

      {/* Document Body */}
      <div className="px-6 py-5 space-y-6 text-sm leading-relaxed text-[var(--color-text-secondary)]">
        {/* Parties */}
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
            Parties
          </h4>
          <div className="space-y-2">
            <p>
              <span className="text-[var(--color-text-muted)]">Platform:</span>{" "}
              <span className="font-semibold text-[var(--color-text-primary)]">
                uhomes.com
              </span>
            </p>
            <p>
              <span className="text-[var(--color-text-muted)]">Partner:</span>{" "}
              <Field label="Company" value={f.partner_company_name ?? ""} />
            </p>
            <p>
              <span className="text-[var(--color-text-muted)]">Contact:</span>{" "}
              <Field label="Contact" value={f.partner_contact_name ?? ""} />
            </p>
            <p>
              <span className="text-[var(--color-text-muted)]">Address:</span>{" "}
              <Field label="Address" value={buildAddress(f)} />
            </p>
          </div>
        </section>

        <hr className="border-[var(--color-border)]" />

        {/* Commission */}
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
            Commission
          </h4>
          <p>
            The Platform shall receive a commission of{" "}
            <Field
              label="Rate"
              value={f.commission_rate ? `${f.commission_rate}%` : ""}
            />{" "}
            on each successful booking referral for the covered properties.
          </p>
        </section>

        <hr className="border-[var(--color-border)]" />

        {/* Contract Period */}
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
            Contract Period
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <p>
              <span className="text-[var(--color-text-muted)]">From:</span>{" "}
              <Field
                label="Start"
                value={formatDate(f.contract_start_date ?? "")}
              />
            </p>
            <p>
              <span className="text-[var(--color-text-muted)]">To:</span>{" "}
              <Field
                label="End"
                value={formatDate(f.contract_end_date ?? "")}
              />
            </p>
          </div>
        </section>

        <hr className="border-[var(--color-border)]" />

        {/* Covered Properties */}
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
            Covered Properties
          </h4>
          <div className="p-3 rounded-md bg-[var(--color-bg-secondary)] border border-[var(--color-border)] whitespace-pre-wrap">
            <Field label="Properties" value={f.covered_properties ?? ""} />
          </div>
        </section>
      </div>
    </div>
  );
}

function buildAddress(f: Partial<ContractFields>): string {
  const parts = [f.partner_address, f.partner_city, f.partner_country].filter(
    Boolean,
  );
  return parts.join(", ");
}

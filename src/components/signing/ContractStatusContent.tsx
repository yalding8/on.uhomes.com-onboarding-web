import {
  Loader2,
  CheckCircle2,
  Clock,
  Mail,
  Download,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import type { ContractStatus, ContractFields } from "@/lib/contracts/types";
import { ContractDocumentPreview } from "@/components/contracts/ContractDocumentPreview";

/** Field labels for the 9 dynamic contract fields */
export const FIELD_LABELS: Record<keyof ContractFields, string> = {
  partner_company_name: "Partner Company",
  partner_contact_name: "Contact Name",
  partner_address: "Address",
  partner_city: "City",
  partner_country: "Country",
  commission_rate: "Commission Rate (%)",
  contract_start_date: "Contract Start Date",
  contract_end_date: "Contract End Date",
  covered_properties: "Covered Properties",
};

/** Field display order */
export const FIELD_ORDER: ReadonlyArray<keyof ContractFields> = [
  "partner_company_name",
  "partner_contact_name",
  "partner_address",
  "partner_city",
  "partner_country",
  "commission_rate",
  "contract_start_date",
  "contract_end_date",
  "covered_properties",
];

/** Status badge */
export function StatusBadge({ status }: { status: ContractStatus }) {
  switch (status) {
    case "SIGNED":
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[var(--color-success-light)] text-[var(--color-success)]">
          <CheckCircle2 className="w-4 h-4 mr-1.5" />
          Signed
        </span>
      );
    case "CANCELED":
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]">
          Canceled
        </span>
      );
    case "PENDING_REVIEW":
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[var(--color-warning-light)] text-[var(--color-warning)]">
          Pending Review
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[var(--color-primary-light)] text-[var(--color-primary)]">
          Processing
        </span>
      );
  }
}

/** Render different content based on contract status */
export function StatusContent({
  status,
  fields,
  documentUrl,
  isLoading,
  onAction,
}: {
  status: ContractStatus;
  fields: ContractFields | null;
  documentUrl: string | null;
  isLoading: boolean;
  onAction: (action: "confirm" | "request_changes" | "resend") => void;
}) {
  switch (status) {
    case "DRAFT":
      return <DraftContent />;
    case "PENDING_REVIEW":
      return (
        <PendingReviewContent
          fields={fields}
          isLoading={isLoading}
          onAction={onAction}
        />
      );
    case "CONFIRMED":
      return <ConfirmedContent />;
    case "SENT":
      return (
        <SentContent
          isLoading={isLoading}
          onResend={() => onAction("resend")}
        />
      );
    case "SIGNED":
      return <SignedContent documentUrl={documentUrl} />;
    case "CANCELED":
      return <CanceledContent />;
  }
}

function DraftContent() {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] mb-4">
        <Clock className="w-8 h-8" />
      </div>
      <h4 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
        Contract is Being Prepared
      </h4>
      <p className="text-sm text-[var(--color-text-secondary)]">
        Our BD team is preparing the partnership agreement for you. Please wait.
      </p>
    </div>
  );
}

function PendingReviewContent({
  fields,
  isLoading,
  onAction,
}: {
  fields: ContractFields | null;
  isLoading: boolean;
  onAction: (action: "confirm" | "request_changes") => void;
}) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Please review the contract terms below carefully. Click &quot;Confirm
        &amp; Sign&quot; once you are satisfied.
      </p>

      <div data-testid="contract-fields">
        <ContractDocumentPreview fields={fields} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          type="button"
          disabled={isLoading}
          onClick={() => onAction("confirm")}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] font-medium transition-colors disabled:opacity-70"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            "Confirm & Sign"
          )}
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={() => onAction("request_changes")}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] font-medium transition-colors disabled:opacity-70"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Request Changes
        </button>
      </div>

      <p className="text-xs text-[var(--color-text-muted)]">
        After clicking &quot;Confirm &amp; Sign&quot;, a DocuSign signing email
        will be sent to your registered email address.
      </p>
    </div>
  );
}

function ConfirmedContent() {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] mb-4">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
      <h4 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
        Creating Signing Request...
      </h4>
      <p className="text-sm text-[var(--color-text-secondary)]">
        The system is creating a DocuSign envelope. Please wait.
      </p>
    </div>
  );
}

function SentContent({
  isLoading,
  onResend,
}: {
  isLoading: boolean;
  onResend: () => void;
}) {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-success-light)] text-[var(--color-success)] mb-4">
        <Mail className="w-8 h-8" />
      </div>
      <h4 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
        Signing Email Sent — Check Your Inbox
      </h4>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        A DocuSign signing link has been sent to your registered email. Please
        follow the instructions to complete the e-signature.
      </p>
      <button
        type="button"
        disabled={isLoading}
        onClick={onResend}
        className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] font-medium text-sm transition-colors disabled:opacity-70"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Mail className="w-4 h-4 mr-2" />
            Resend Signing Email
          </>
        )}
      </button>
    </div>
  );
}

function SignedContent({ documentUrl }: { documentUrl: string | null }) {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-success-light)] text-[var(--color-success)] mb-4">
        <CheckCircle2 className="w-8 h-8" />
      </div>
      <h4 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
        Contract Signed Successfully
      </h4>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        Your partnership agreement has been signed and is now in effect. Thank
        you for your trust and cooperation.
      </p>
      {documentUrl && (
        <a
          href={documentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] font-medium transition-colors"
        >
          <Download className="w-4 h-4 mr-2" />
          Download Signed Contract (PDF)
        </a>
      )}
    </div>
  );
}
function CanceledContent() {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] mb-4">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h4 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
        Contract Canceled
      </h4>
      <p className="text-sm text-[var(--color-text-secondary)]">
        This contract has been canceled. Please contact the BD team if you have
        any questions.
      </p>
    </div>
  );
}

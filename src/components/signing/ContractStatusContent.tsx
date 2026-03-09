import {
  Loader2,
  CheckCircle2,
  Clock,
  Mail,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import type { ContractStatus, ContractFields } from "@/lib/contracts/types";
export { FIELD_LABELS, FIELD_ORDER } from "@/lib/contracts/types";
import { ContractDocumentPreview } from "@/components/contracts/ContractDocumentPreview";
import { SignedContractDownload } from "@/components/contracts/SignedContractDownload";

/** Status badge */
export function StatusBadge({ status }: { status: ContractStatus }) {
  switch (status) {
    case "SIGNED":
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[var(--color-success-light)] text-[var(--color-success)]">
          <CheckCircle2 className="w-4 h-4 me-1.5" />
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
  uploadedDocumentUrl,
  contractId,
  isLoading,
  onAction,
}: {
  status: ContractStatus;
  fields: ContractFields | null;
  documentUrl: string | null;
  uploadedDocumentUrl?: string | null;
  contractId: string;
  isLoading: boolean;
  onAction: (action: "confirm" | "request_changes" | "resend") => void;
}) {
  const hasCustomPdf = !!uploadedDocumentUrl;

  switch (status) {
    case "DRAFT":
      return <DraftContent contractId={hasCustomPdf ? contractId : null} />;
    case "PENDING_REVIEW":
      return (
        <PendingReviewContent
          fields={fields}
          contractId={hasCustomPdf ? contractId : null}
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
      return (
        <SignedContent documentUrl={documentUrl} contractId={contractId} />
      );
    case "CANCELED":
      return <CanceledContent />;
  }
}

function DraftContent({ contractId }: { contractId: string | null }) {
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
      {contractId && (
        <div className="mt-6">
          <SignedContractDownload
            contractId={contractId}
            label="Preview Contract PDF"
            variant="link"
          />
        </div>
      )}
    </div>
  );
}

function PendingReviewContent({
  fields,
  contractId,
  isLoading,
  onAction,
}: {
  fields: ContractFields | null;
  contractId: string | null;
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

      {contractId && (
        <SignedContractDownload
          contractId={contractId}
          label="Download Contract PDF"
          variant="link"
        />
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          type="button"
          disabled={isLoading}
          onClick={() => onAction("confirm")}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] font-medium transition-all active:scale-[0.98] disabled:opacity-70"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 me-2 animate-spin" />
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
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] font-medium transition-all active:scale-[0.98] disabled:opacity-70"
        >
          <ArrowLeft className="w-4 h-4 me-2" />
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
        className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] font-medium text-sm transition-all active:scale-[0.98] disabled:opacity-70"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 me-2 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Mail className="w-4 h-4 me-2" />
            Resend Signing Email
          </>
        )}
      </button>
    </div>
  );
}

function SignedContent({
  documentUrl,
  contractId,
}: {
  documentUrl: string | null;
  contractId: string;
}) {
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
      {documentUrl && <SignedContractDownload contractId={contractId} />}
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

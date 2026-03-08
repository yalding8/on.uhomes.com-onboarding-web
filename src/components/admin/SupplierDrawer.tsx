"use client";

/**
 * Supplier preview drawer (desktop side panel / mobile full-screen).
 *
 * Shows supplier summary, pipeline stage, next action, contact info,
 * and contract status with a link to the full detail page.
 */

import { useEffect, useCallback, useState } from "react";
import {
  X,
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Globe,
  ExternalLink,
  FileText,
  Copy,
  Check,
} from "lucide-react";
import Link from "next/link";
import { type PipelineStage, PIPELINE_STAGES } from "@/lib/suppliers/pipeline";

interface SupplierDrawerProps {
  supplier: {
    id: string;
    company_name: string;
    contact_email: string;
    contact_phone: string | null;
    city: string | null;
    country: string | null;
    website_url: string | null;
    status: string;
    pipeline_stage: PipelineStage;
    contract_status: string | null;
    next_action: { text: string; actionType?: "copy_email" | "link" };
  };
  onClose: () => void;
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="text-[var(--color-text-muted)] mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
        <div className="text-sm text-[var(--color-text-primary)] break-words">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Map contract status to a display-friendly label + color */
function contractBadge(status: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    DRAFT: { label: "Draft", color: "var(--color-text-muted)" },
    PENDING_REVIEW: {
      label: "Pending Review",
      color: "var(--color-warning)",
    },
    CONFIRMED: { label: "Confirmed", color: "var(--color-primary)" },
    SENT: { label: "Sent", color: "var(--color-warning)" },
    SIGNED: { label: "Signed", color: "var(--color-success)" },
  };
  return map[status] ?? { label: status, color: "var(--color-text-muted)" };
}

export function SupplierDrawer({ supplier, onClose }: SupplierDrawerProps) {
  const [copied, setCopied] = useState(false);

  const stageInfo = PIPELINE_STAGES.find(
    (s) => s.value === supplier.pipeline_stage,
  );

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(supplier.contact_email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail in some contexts; ignore silently
    }
  };

  const drawerContent = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile back button */}
          <button
            onClick={onClose}
            className="md:hidden text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] truncate">
              {supplier.company_name}
            </h2>
            {stageInfo && (
              <span
                className="inline-flex items-center gap-1.5 mt-1 text-xs font-medium px-2 py-0.5 rounded-full"
                style={{
                  color: stageInfo.color,
                  backgroundColor: `color-mix(in srgb, ${stageInfo.color} 12%, transparent)`,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: stageInfo.color }}
                />
                {stageInfo.label}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="hidden md:block text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Next Action Banner */}
        <div className="rounded-lg bg-[color-mix(in_srgb,var(--color-warning)_12%,transparent)] border border-[color-mix(in_srgb,var(--color-warning)_30%,transparent)] p-3">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            {supplier.next_action.text}
          </p>
          {supplier.next_action.actionType === "copy_email" && (
            <button
              onClick={handleCopyEmail}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors active:scale-[0.97]"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy Email
                </>
              )}
            </button>
          )}
        </div>

        {/* Contact Info */}
        <div>
          <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
            Contact Information
          </p>
          <div className="space-y-0.5">
            <InfoRow icon={<Mail className="h-4 w-4" />} label="Email">
              <a
                href={`mailto:${supplier.contact_email}`}
                className="text-[var(--color-primary)] hover:underline"
              >
                {supplier.contact_email}
              </a>
            </InfoRow>
            <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone">
              {supplier.contact_phone ?? "\u2014"}
            </InfoRow>
            <InfoRow icon={<MapPin className="h-4 w-4" />} label="Location">
              {[supplier.city, supplier.country].filter(Boolean).join(", ") ||
                "\u2014"}
            </InfoRow>
            <InfoRow icon={<Globe className="h-4 w-4" />} label="Website">
              {supplier.website_url ? (
                <a
                  href={supplier.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-primary)] hover:underline inline-flex items-center gap-1"
                >
                  {new URL(supplier.website_url).hostname}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                "\u2014"
              )}
            </InfoRow>
          </div>
        </div>

        {/* Contract Summary */}
        <div>
          <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
            Contract
          </p>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[var(--color-text-muted)]" />
            {supplier.contract_status ? (
              <span
                className="inline-flex items-center gap-1.5 text-sm font-medium px-2 py-0.5 rounded-full"
                style={{
                  color: contractBadge(supplier.contract_status).color,
                  backgroundColor: `color-mix(in srgb, ${contractBadge(supplier.contract_status).color} 12%, transparent)`,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    backgroundColor: contractBadge(supplier.contract_status)
                      .color,
                  }}
                />
                {contractBadge(supplier.contract_status).label}
              </span>
            ) : (
              <span className="text-sm text-[var(--color-text-muted)]">
                No contract yet
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--color-border)]">
        <Link
          href={`/admin/suppliers/${supplier.id}`}
          className="block w-full py-2 rounded-lg text-sm font-medium text-white text-center bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] transition-all"
        >
          View Details
        </Link>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: side drawer */}
      <div className="hidden md:block">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
        {/* Drawer panel */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Supplier details: ${supplier.company_name}`}
          className="fixed inset-y-0 end-0 z-50 w-[420px] lg:w-[420px] md:w-[360px] bg-[var(--color-bg-primary)] shadow-xl border-s border-[var(--color-border)] flex flex-col animate-slide-in-right"
        >
          {drawerContent}
        </div>
      </div>

      {/* Mobile: full screen */}
      <div className="md:hidden fixed inset-0 z-50 bg-[var(--color-bg-primary)] flex flex-col">
        {drawerContent}
      </div>
    </>
  );
}

"use client";

/**
 * Application detail drawer (desktop) / full-screen page (mobile).
 *
 * Shows application info, BD assignment, notes, and action buttons.
 */

import { useEffect, useCallback } from "react";
import {
  X,
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  Calendar,
  Tag,
  ExternalLink,
} from "lucide-react";
import type { ApplicationRow, BdOption } from "@/app/admin/applications/page";
import { ApplicationBdSelect } from "./ApplicationBdSelect";
import { ApplicationNotes } from "./ApplicationNotes";
import { ClaimButton } from "./ClaimButton";
import { formatRelativeTime } from "@/lib/utils/relative-time";

interface ApplicationDrawerProps {
  application: ApplicationRow;
  bdUsers: BdOption[];
  isAdmin: boolean;
  currentBdId: string;
  onClose: () => void;
  onApprove: (application: ApplicationRow) => void;
}

/** Format precise date for drawer display */
function formatPreciseDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(iso));
}

/** Supplier type abbreviation map */
const TYPE_SHORT: Record<string, string> = {
  "Purpose Built Student Accommodation Provider": "PBSA",
  "Property Management Company": "PMC",
  "Lettings Agent/Broker": "Agent",
  "Hotel Provider": "Hotel",
  "New homes developer": "Developer",
  Sublessor: "Sublessor",
  "Individual landlord": "Landlord",
  "Built to Rent Accommodation Provider": "BTR",
  "Co-living Provider": "Co-living",
};

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

export function ApplicationDrawer({
  application: app,
  bdUsers,
  isAdmin,
  currentBdId,
  onClose,
  onApprove,
}: ApplicationDrawerProps) {
  const isPending = app.status === "PENDING";
  const isOwnApp = app.assigned_bd_id === currentBdId;
  const isUnassigned = app.assigned_bd_id === null;
  const canEdit = isAdmin || isOwnApp;

  // Show claim button: BD + unassigned + PENDING
  const showClaim = !isAdmin && isUnassigned && isPending;

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
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] truncate">
            {app.company_name}
          </h2>
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
        {/* Basic Info */}
        <div>
          <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
            Application Details
          </p>
          <div className="space-y-0.5">
            <InfoRow icon={<Building2 className="h-4 w-4" />} label="Type">
              {app.supplier_type
                ? (TYPE_SHORT[app.supplier_type] ?? app.supplier_type)
                : "—"}
            </InfoRow>
            <InfoRow icon={<Mail className="h-4 w-4" />} label="Email">
              <a
                href={`mailto:${app.contact_email}`}
                className="text-[var(--color-primary)] hover:underline"
              >
                {app.contact_email}
              </a>
            </InfoRow>
            <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone">
              {app.contact_phone ?? "—"}
            </InfoRow>
            <InfoRow icon={<MapPin className="h-4 w-4" />} label="Country">
              {app.country ?? "—"}
            </InfoRow>
            <InfoRow icon={<Globe className="h-4 w-4" />} label="Website">
              {app.website_url ? (
                <a
                  href={app.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-primary)] hover:underline inline-flex items-center gap-1"
                >
                  {new URL(app.website_url).hostname}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                "—"
              )}
            </InfoRow>
            <InfoRow icon={<Calendar className="h-4 w-4" />} label="Applied">
              {formatPreciseDate(app.created_at)}
              <span className="text-xs text-[var(--color-text-muted)] ms-1">
                ({formatRelativeTime(app.created_at)})
              </span>
            </InfoRow>
            {app.referral_code && (
              <InfoRow icon={<Tag className="h-4 w-4" />} label="Referral">
                {app.referral_code}
              </InfoRow>
            )}
          </div>
        </div>

        {/* BD Assignment */}
        <div>
          <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
            BD Assignment
          </p>
          {isAdmin ? (
            <ApplicationBdSelect
              applicationId={app.id}
              currentBdId={app.assigned_bd_id}
              bdUsers={bdUsers}
            />
          ) : showClaim ? (
            <ClaimButton applicationId={app.id} onClaimed={onClose} />
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">
              {isOwnApp
                ? "Assigned to you"
                : `Assigned to ${bdUsers.find((b) => b.id === app.assigned_bd_id)?.company_name ?? "another BD"}`}
            </p>
          )}
        </div>

        {/* Notes */}
        {canEdit && (
          <ApplicationNotes applicationId={app.id} canEdit={canEdit} />
        )}
      </div>

      {/* Footer actions */}
      {isPending && canEdit && (
        <div className="p-4 border-t border-[var(--color-border)] flex gap-3">
          <button
            onClick={() => onApprove(app)}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] transition-all"
          >
            Approve
          </button>
        </div>
      )}
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
          aria-label={`Application details: ${app.company_name}`}
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

"use client";

/**
 * ExtractionJobsCard — Shows extraction job history for a building.
 */

import {
  FileText,
  Globe,
  Sheet,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils/relative-time";

interface ExtractionJob {
  id: string;
  source: string;
  status: string;
  extracted_data: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface ExtractionJobsCardProps {
  jobs: ExtractionJob[];
}

const SOURCE_CONFIG: Record<string, { label: string; Icon: typeof FileText }> =
  {
    contract_pdf: { label: "Contract PDF", Icon: FileText },
    website_crawl: { label: "Website Crawl", Icon: Globe },
    google_sheets: { label: "Google Sheets", Icon: Sheet },
  };

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; Icon: typeof Clock }
> = {
  pending: {
    label: "Pending",
    color: "var(--color-text-muted)",
    Icon: Clock,
  },
  running: {
    label: "Running",
    color: "var(--color-info, #2563EB)",
    Icon: Clock,
  },
  completed: {
    label: "Completed",
    color: "var(--color-success, #16A34A)",
    Icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    color: "var(--color-primary)",
    Icon: XCircle,
  },
  timeout: {
    label: "Timeout",
    color: "var(--color-warning, #EA580C)",
    Icon: AlertTriangle,
  },
};

export function ExtractionJobsCard({ jobs }: ExtractionJobsCardProps) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-hidden">
      <div className="p-4 border-b border-[var(--color-border)]">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Extraction Jobs ({jobs.length})
        </h3>
      </div>
      <div className="divide-y divide-[var(--color-border)] max-h-96 overflow-y-auto">
        {jobs.map((job) => {
          const src = SOURCE_CONFIG[job.source] ?? {
            label: job.source,
            Icon: FileText,
          };
          const st = STATUS_CONFIG[job.status] ?? {
            label: job.status,
            color: "var(--color-text-muted)",
            Icon: Clock,
          };
          const SrcIcon = src.Icon;
          const StIcon = st.Icon;
          const fieldCount = job.extracted_data
            ? Object.keys(job.extracted_data).length
            : 0;

          return (
            <div key={job.id} className="p-3 space-y-2">
              {/* Source + status row */}
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm text-[var(--color-text-primary)]">
                  <SrcIcon className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                  {src.label}
                </span>
                <span
                  className="inline-flex items-center gap-1 text-xs font-medium"
                  style={{ color: st.color }}
                >
                  <StIcon className="w-3 h-3" />
                  {st.label}
                </span>
              </div>

              {/* Details row */}
              <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                <span>
                  {fieldCount > 0
                    ? `${fieldCount} field${fieldCount !== 1 ? "s" : ""} extracted`
                    : "No fields extracted"}
                </span>
                {job.completed_at ? (
                  <span>{formatRelativeTime(job.completed_at)}</span>
                ) : (
                  <span>Created {formatRelativeTime(job.created_at)}</span>
                )}
              </div>

              {/* Error message */}
              {job.error_message && (
                <p className="text-xs text-[var(--color-primary)] bg-[var(--color-primary-bg,_#FFF1F2)] rounded px-2 py-1">
                  {job.error_message}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { AlertTriangle, RefreshCw } from "lucide-react";
import type { BuildingStatus } from "@/lib/onboarding/status-engine";

export function ConflictBanner({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-xl border p-4"
      style={{
        borderColor: "var(--color-warning)",
        backgroundColor: "var(--color-warning-light)",
      }}
    >
      <AlertTriangle
        className="w-5 h-5 shrink-0"
        style={{ color: "var(--color-warning)" }}
      />
      <div className="flex-1">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">
          Data was modified by another user
        </p>
        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
          Please refresh to see the latest changes. Your unsaved edits may be
          lost.
        </p>
      </div>
      <button
        onClick={onRefresh}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] transition-all shrink-0"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Refresh
      </button>
    </div>
  );
}

export function StatusLabel({ status }: { status: BuildingStatus }) {
  const map: Record<BuildingStatus, { label: string; color: string }> = {
    extracting: { label: "Extracting", color: "var(--color-text-muted)" },
    incomplete: { label: "Draft", color: "var(--color-warning)" },
    previewable: {
      label: "Ready to Preview",
      color: "var(--color-success)",
    },
    ready_to_publish: {
      label: "Ready to Publish",
      color: "var(--color-primary)",
    },
    published: { label: "Published", color: "var(--color-success)" },
  };
  const cfg = map[status] ?? map.incomplete;
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full border"
      style={{ color: cfg.color, borderColor: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

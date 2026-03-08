"use client";

/**
 * Building progress cards for supplier detail page.
 * Shows score progress bars sorted by lowest score first.
 */

import { Building2 } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils/relative-time";

interface BuildingInfo {
  id: string;
  building_name: string;
  building_address: string | null;
  onboarding_status: string;
  score: number;
  missing_count: number;
  updated_at: string | null;
}

interface BuildingProgressCardProps {
  buildings: BuildingInfo[];
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  extracting: {
    bg: "var(--color-info-bg, #EFF6FF)",
    text: "var(--color-info, #2563EB)",
  },
  incomplete: {
    bg: "var(--color-warning-bg, #FFF7ED)",
    text: "var(--color-warning, #EA580C)",
  },
  previewable: {
    bg: "var(--color-primary-bg, #FFF1F2)",
    text: "var(--color-primary)",
  },
  ready_to_publish: {
    bg: "var(--color-primary-bg, #FFF1F2)",
    text: "var(--color-primary)",
  },
  published: {
    bg: "var(--color-success-bg, #F0FDF4)",
    text: "var(--color-success, #16A34A)",
  },
};

function getStatusStyle(status: string) {
  return (
    STATUS_STYLES[status] ?? {
      bg: "var(--color-bg-secondary)",
      text: "var(--color-text-muted)",
    }
  );
}

function formatStatusLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** HSL hue: 0 (red) at score 0, 30 (orange) at 50, 120 (green) at 100 */
function scoreToHue(score: number): number {
  const clamped = Math.max(0, Math.min(100, score));
  if (clamped <= 50) {
    return (clamped / 50) * 30;
  }
  return 30 + ((clamped - 50) / 50) * 90;
}

export function BuildingProgressCard({ buildings }: BuildingProgressCardProps) {
  if (buildings.length === 0) {
    return (
      <div className="py-8 text-center">
        <Building2 className="h-10 w-10 text-[var(--color-text-muted)] opacity-30 mx-auto mb-3" />
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">
          No buildings yet
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Buildings will appear here once added by the supplier
        </p>
      </div>
    );
  }

  const sorted = [...buildings].sort((a, b) => a.score - b.score);

  return (
    <div className="space-y-3">
      {sorted.map((b) => {
        const hue = scoreToHue(b.score);
        const barColor = `hsl(${hue}, 80%, 45%)`;
        const style = getStatusStyle(b.onboarding_status);

        return (
          <div
            key={b.id}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4 transition-shadow hover:shadow-md"
          >
            {/* Header row */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                  {b.building_name}
                </p>
                {b.building_address && (
                  <p className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">
                    {b.building_address}
                  </p>
                )}
              </div>
              <span
                className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: style.bg,
                  color: style.text,
                }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: style.text }}
                />
                {formatStatusLabel(b.onboarding_status)}
              </span>
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1 h-2 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(2, b.score)}%`,
                    backgroundColor: barColor,
                  }}
                />
              </div>
              <span
                className="shrink-0 text-xs font-bold tabular-nums"
                style={{ color: barColor }}
              >
                {b.score}/100
              </span>
            </div>

            {/* Footer row */}
            <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
              {b.missing_count > 0 ? (
                <span>
                  {b.missing_count} field{b.missing_count !== 1 ? "s" : ""}{" "}
                  missing
                </span>
              ) : (
                <span className="text-[var(--color-success, #16A34A)]">
                  All fields complete
                </span>
              )}
              {b.updated_at && (
                <span>Updated {formatRelativeTime(b.updated_at)}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * BuildingCard — Dashboard 上的 building 状态卡片。
 * 展示名称、ScoreBar、缺失字段数、状态标签，点击导航至编辑页。
 */

import Link from "next/link";
import { ScoreBar } from "./ScoreBar";
import type { BuildingStatus } from "@/lib/onboarding/status-engine";

interface BuildingCardProps {
  buildingId: string;
  buildingName: string;
  address: string;
  score: number;
  missingCount: number;
  status: BuildingStatus;
}

const STATUS_CONFIG: Record<
  BuildingStatus,
  { label: string; color: string; bg: string }
> = {
  extracting: {
    label: "Extracting Data",
    color: "var(--color-text-muted)",
    bg: "var(--color-bg-secondary)",
  },
  incomplete: {
    label: "Incomplete",
    color: "var(--color-warning)",
    bg: "var(--color-primary-light)",
  },
  previewable: {
    label: "Ready to Preview",
    color: "var(--color-success)",
    bg: "var(--color-success-light)",
  },
  ready_to_publish: {
    label: "Ready to Publish",
    color: "var(--color-primary)",
    bg: "var(--color-primary-light)",
  },
  published: {
    label: "Published",
    color: "var(--color-success)",
    bg: "var(--color-success-light)",
  },
};

export function BuildingCard({
  buildingId,
  buildingName,
  address,
  score,
  missingCount,
  status,
}: BuildingCardProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.incomplete;

  return (
    <Link
      href={`/onboarding/${buildingId}`}
      className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)] truncate">
            {buildingName}
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)] truncate mt-0.5">
            {address}
          </p>
        </div>
        <span
          className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full"
          style={{ color: cfg.color, backgroundColor: cfg.bg }}
        >
          {cfg.label}
        </span>
      </div>

      <ScoreBar score={score} size="sm" />

      {missingCount > 0 && (
        <p className="text-xs text-[var(--color-text-muted)] mt-2">
          {missingCount} fields remaining
        </p>
      )}
    </Link>
  );
}

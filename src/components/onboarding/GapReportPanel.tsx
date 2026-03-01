/**
 * GapReportPanel — 缺失字段清单面板。
 * 按分类展示缺失字段及其建议操作。
 */

import type { GapReport } from "@/lib/onboarding/gap-report";
import {
  FIELD_CATEGORY_LABELS,
  type FieldCategory,
} from "@/lib/onboarding/field-schema";

interface GapReportPanelProps {
  gapReport: GapReport;
}

const TIER_COLORS: Record<string, string> = {
  "Auto-extractable": "var(--color-success)",
  "Needs confirmation": "var(--color-warning)",
  "Manual input required": "var(--color-primary)",
};

export function GapReportPanel({ gapReport }: GapReportPanelProps) {
  const categories = Object.keys(
    gapReport.missingByCategory,
  ) as FieldCategory[];
  const totalMissing = gapReport.totalFields - gapReport.filledFields;

  if (totalMissing === 0) {
    return (
      <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-success-light)]">
        <p
          className="text-sm font-medium"
          style={{ color: "var(--color-success)" }}
        >
          All fields completed
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-hidden">
      <div className="p-4 border-b border-[var(--color-border)]">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Missing Fields ({totalMissing})
        </h3>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          {gapReport.filledFields}/{gapReport.totalFields} completed
        </p>
      </div>
      <div className="divide-y divide-[var(--color-border)] max-h-96 overflow-y-auto">
        {categories.map((cat) => {
          const items = gapReport.missingByCategory[cat];
          if (!items || items.length === 0) return null;
          return (
            <div key={cat} className="p-3">
              <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                {FIELD_CATEGORY_LABELS[cat]} ({items.length})
              </p>
              <ul className="space-y-1">
                {items.map((item) => (
                  <li
                    key={item.fieldKey}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-[var(--color-text-primary)] truncate mr-2">
                      {item.label}
                    </span>
                    <span
                      className="shrink-0"
                      style={{
                        color:
                          TIER_COLORS[item.suggestion] ??
                          "var(--color-text-muted)",
                      }}
                    >
                      {item.suggestion}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

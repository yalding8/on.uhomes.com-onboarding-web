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
  可自动提取: "var(--color-success)",
  需确认: "var(--color-warning)",
  需手动填写: "var(--color-primary)",
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
          所有字段已填写完成
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-hidden">
      <div className="p-4 border-b border-[var(--color-border)]">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          缺失字段 ({totalMissing})
        </h3>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          已完成 {gapReport.filledFields}/{gapReport.totalFields}
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

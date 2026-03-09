"use client";

/**
 * BuildingFieldsView — Displays all onboarding fields grouped by category.
 * Collapsible sections with fill/miss indicators.
 */

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import type { FieldValue, Confidence } from "@/lib/onboarding/field-value";
import type { ScoreResult } from "@/lib/onboarding/scoring-engine";
import {
  FIELD_CATEGORY_LABELS,
  getFieldsByCategory,
  ALL_CATEGORIES,
  type FieldCategory,
} from "@/lib/onboarding/field-schema";
import { hasValue } from "@/lib/onboarding/field-value";

interface BuildingFieldsViewProps {
  fieldValues: Record<string, FieldValue>;
  scoreResult: ScoreResult;
}

const SOURCE_STYLES: Record<string, { label: string; color: string }> = {
  contract_pdf: { label: "Contract", color: "var(--color-info, #2563EB)" },
  website_crawl: { label: "Website", color: "var(--color-success, #16A34A)" },
  google_sheets: { label: "Sheets", color: "var(--color-warning, #EA580C)" },
  manual_input: {
    label: "Manual",
    color: "var(--color-text-secondary)",
  },
};

const CONFIDENCE_CONFIG: Record<
  Confidence,
  { Icon: typeof CheckCircle2; color: string }
> = {
  high: { Icon: CheckCircle2, color: "var(--color-success, #16A34A)" },
  medium: { Icon: AlertTriangle, color: "var(--color-warning, #EA580C)" },
  low: { Icon: AlertTriangle, color: "var(--color-primary)" },
};

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "number") return String(val);
  if (typeof val === "string") {
    return val.length > 120 ? val.slice(0, 117) + "..." : val;
  }
  if (Array.isArray(val)) {
    const joined = val.join(", ");
    return joined.length > 120 ? joined.slice(0, 117) + "..." : joined;
  }
  if (typeof val === "object") {
    const s = JSON.stringify(val);
    return s.length > 120 ? s.slice(0, 117) + "..." : s;
  }
  return String(val);
}

export function BuildingFieldsView({
  fieldValues,
  scoreResult,
}: BuildingFieldsViewProps) {
  const grouped = getFieldsByCategory();

  // Default: first 3 categories open
  const initialOpen = new Set(ALL_CATEGORIES.slice(0, 3));
  const [openSections, setOpenSections] = useState<Set<FieldCategory>>(
    () => initialOpen,
  );

  function toggle(cat: FieldCategory) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {ALL_CATEGORIES.map((cat) => {
        const fields = grouped[cat];
        if (!fields || fields.length === 0) return null;

        const isOpen = openSections.has(cat);
        const filledCount = fields.filter(
          (f) => scoreResult.fieldDetails[f.key]?.filled,
        ).length;

        return (
          <section
            key={cat}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] overflow-hidden"
          >
            {/* Category header */}
            <button
              type="button"
              onClick={() => toggle(cat)}
              className="flex w-full items-center justify-between p-4 text-start hover:bg-[var(--color-bg-secondary)] transition-colors"
            >
              <span className="flex items-center gap-2">
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
                )}
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {FIELD_CATEGORY_LABELS[cat]}
                </span>
              </span>
              <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
                {filledCount}/{fields.length}
              </span>
            </button>

            {/* Fields list */}
            {isOpen && (
              <div className="border-t border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                {fields.map((field) => {
                  const fv = fieldValues[field.key];
                  const filled = hasValue(fv);
                  return (
                    <FieldRow
                      key={field.key}
                      label={field.label}
                      fieldValue={fv}
                      filled={filled}
                    />
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/* ── Field row sub-component ── */

function FieldRow({
  label,
  fieldValue,
  filled,
}: {
  label: string;
  fieldValue: FieldValue | undefined;
  filled: boolean;
}) {
  if (!filled || !fieldValue) {
    return (
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="text-sm text-[var(--color-text-muted)]">{label}</span>
        <span className="text-sm text-[var(--color-text-muted)]">—</span>
      </div>
    );
  }

  const srcStyle = SOURCE_STYLES[fieldValue.source];
  const confCfg = CONFIDENCE_CONFIG[fieldValue.confidence];
  const ConfIcon = confCfg.Icon;

  return (
    <div className="flex items-start justify-between gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[var(--color-text-secondary)] mb-0.5">
          {label}
        </p>
        <p className="text-sm text-[var(--color-text-primary)] break-words">
          {formatValue(fieldValue.value)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0 pt-0.5">
        {srcStyle && (
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={{
              color: srcStyle.color,
              backgroundColor: `color-mix(in srgb, ${srcStyle.color} 12%, transparent)`,
            }}
          >
            {srcStyle.label}
          </span>
        )}
        <ConfIcon
          className="w-3.5 h-3.5"
          style={{ color: confCfg.color }}
          aria-label={`Confidence: ${fieldValue.confidence}`}
        />
      </div>
    </div>
  );
}

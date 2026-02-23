"use client";

/**
 * FieldGroup — 按分类分组的字段编辑区域。
 * 可折叠展开，标题旁显示该分类的完成度。
 */

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FieldEditor } from "./FieldEditor";
import type {
  FieldDefinition,
  FieldCategory,
} from "@/lib/onboarding/field-schema";
import { FIELD_CATEGORY_LABELS } from "@/lib/onboarding/field-schema";
import type { FieldValue } from "@/lib/onboarding/field-value";
import { hasValue } from "@/lib/onboarding/field-value";

interface FieldGroupProps {
  category: FieldCategory;
  fields: FieldDefinition[];
  fieldValues: Record<string, FieldValue>;
  onChange: (key: string, value: unknown) => void;
  disabled?: boolean;
  defaultOpen?: boolean;
}

export function FieldGroup({
  category,
  fields,
  fieldValues,
  onChange,
  disabled,
  defaultOpen = false,
}: FieldGroupProps) {
  const [open, setOpen] = useState(defaultOpen);

  const filled = fields.filter((f) => hasValue(fieldValues[f.key])).length;
  const total = fields.length;
  const allDone = filled === total;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--color-bg-primary)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {FIELD_CATEGORY_LABELS[category]}
          </h3>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              color: allDone
                ? "var(--color-success)"
                : "var(--color-text-muted)",
              backgroundColor: allDone
                ? "var(--color-success-light)"
                : "var(--color-bg-primary)",
            }}
          >
            {filled}/{total}
          </span>
        </div>
        <ChevronDown
          className="w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 divide-y divide-[var(--color-border)]">
          {fields.map((field) => (
            <FieldEditor
              key={field.key}
              field={field}
              fieldValue={fieldValues[field.key]}
              onChange={onChange}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}

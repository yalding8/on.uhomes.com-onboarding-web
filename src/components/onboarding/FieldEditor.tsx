"use client";

/**
 * FieldEditor — 单个字段的编辑器。
 * 根据 FieldDefinition.type 渲染不同输入控件。
 * 编辑后通过 onChange 回调通知父组件。
 */

import { useCallback } from "react";
import { SourceBadge } from "./SourceBadge";
import type { FieldDefinition } from "@/lib/onboarding/field-schema";
import type { FieldValue, DataSource } from "@/lib/onboarding/field-value";

interface FieldEditorProps {
  field: FieldDefinition;
  fieldValue?: FieldValue;
  onChange: (key: string, value: unknown) => void;
  disabled?: boolean;
}

export function FieldEditor({
  field,
  fieldValue,
  onChange,
  disabled,
}: FieldEditorProps) {
  const currentValue = fieldValue?.value ?? "";
  const source = fieldValue?.source as DataSource | undefined;

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-2 mb-1.5">
        <label
          htmlFor={`field-${field.key}`}
          className="text-sm font-medium text-[var(--color-text-primary)]"
        >
          {field.label}
          {field.required && (
            <span className="ml-0.5" style={{ color: "var(--color-primary)" }}>
              *
            </span>
          )}
        </label>
        {source && <SourceBadge source={source} />}
      </div>
      {field.description && (
        <p className="text-xs text-[var(--color-text-muted)] mb-1.5">
          {field.description}
        </p>
      )}
      <FieldInput
        field={field}
        value={currentValue}
        onChange={(val) => onChange(field.key, val)}
        disabled={disabled}
      />
    </div>
  );
}

/** 根据 FieldType 渲染对应的输入控件 */
function FieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FieldDefinition;
  value: unknown;
  onChange: (val: unknown) => void;
  disabled?: boolean;
}) {
  const inputClass =
    "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] disabled:opacity-50";

  switch (field.type) {
    case "boolean":
      return (
        <BooleanInput
          id={`field-${field.key}`}
          checked={value === true}
          onChange={onChange}
          disabled={disabled}
        />
      );

    case "select":
      return (
        <select
          id={`field-${field.key}`}
          className={inputClass}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled}
        >
          <option value="">Select...</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );

    case "multi_select":
      return (
        <MultiSelectInput
          id={`field-${field.key}`}
          options={field.options ?? []}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
          disabled={disabled}
        />
      );

    case "number":
      return (
        <input
          id={`field-${field.key}`}
          type="number"
          className={inputClass}
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) =>
            onChange(e.target.value ? Number(e.target.value) : null)
          }
          disabled={disabled}
        />
      );

    case "url":
    case "email":
    case "phone":
      return (
        <input
          id={`field-${field.key}`}
          type={
            field.type === "url"
              ? "url"
              : field.type === "email"
                ? "email"
                : "tel"
          }
          className={inputClass}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder={field.type === "url" ? "https://..." : ""}
          disabled={disabled}
        />
      );

    default:
      // text, json, image_urls — 都用 textarea 或 text input
      const isLong =
        field.type === "json" ||
        field.type === "image_urls" ||
        field.key.includes("policy") ||
        field.key.includes("description");
      if (isLong) {
        return (
          <textarea
            id={`field-${field.key}`}
            className={`${inputClass} min-h-[80px] resize-y`}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={disabled}
          />
        );
      }
      return (
        <input
          id={`field-${field.key}`}
          type="text"
          className={inputClass}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled}
        />
      );
  }
}

function BooleanInput({
  id,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  checked: boolean;
  onChange: (val: unknown) => void;
  disabled?: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 disabled:opacity-50"
      style={{
        backgroundColor: checked
          ? "var(--color-success)"
          : "var(--color-border)",
      }}
    >
      <span
        className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{ transform: checked ? "translateX(1.25rem)" : "translateX(0)" }}
      />
    </button>
  );
}

function MultiSelectInput({
  id,
  options,
  value,
  onChange,
  disabled,
}: {
  id: string;
  options: string[];
  value: string[];
  onChange: (val: unknown) => void;
  disabled?: boolean;
}) {
  const toggle = useCallback(
    (opt: string) => {
      const next = value.includes(opt)
        ? value.filter((v) => v !== opt)
        : [...value, opt];
      onChange(next.length > 0 ? next : null);
    },
    [value, onChange],
  );

  return (
    <div
      id={id}
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="Multi select options"
    >
      {options.map((opt) => {
        const selected = value.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            disabled={disabled}
            className="px-3 py-1.5 text-xs rounded-full border transition-colors disabled:opacity-50"
            style={{
              borderColor: selected
                ? "var(--color-primary)"
                : "var(--color-border)",
              backgroundColor: selected
                ? "var(--color-primary-light)"
                : "var(--color-bg-primary)",
              color: selected
                ? "var(--color-primary)"
                : "var(--color-text-secondary)",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

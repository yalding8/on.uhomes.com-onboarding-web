"use client";

/**
 * 合同编辑表单 — Client Component
 *
 * DRAFT 状态：可编辑所有字段，保存 + 推送审阅按钮
 * 非 DRAFT 状态：只读模式，显示当前状态
 * 自动预填 partner_company_name 和 partner_city（仅当字段为空时）
 *
 * Requirements: 3.1, 3.2, 3.5, 4.2, 4.4
 */

import { useState, useCallback, useMemo } from "react";
import type { ContractFields, ContractStatus } from "@/lib/contracts/types";
import { CONTRACT_FIELD_KEYS } from "@/lib/contracts/types";

export interface ContractEditFormProps {
  contractId: string;
  initialFields: Partial<ContractFields>;
  supplierInfo: { company_name: string; city: string | null };
  contractStatus: ContractStatus;
}

/** Field labels */
const FIELD_LABELS: Record<keyof ContractFields, string> = {
  partner_company_name: "Partner Company Name",
  partner_contact_name: "Partner Contact Name",
  partner_address: "Partner Address",
  partner_city: "Partner City",
  partner_country: "Partner Country",
  commission_rate: "Commission Rate (%)",
  contract_start_date: "Contract Start Date",
  contract_end_date: "Contract End Date",
  covered_properties: "Covered Properties",
};

/** 字段输入类型映射 */
const FIELD_INPUT_TYPES: Partial<Record<keyof ContractFields, string>> = {
  commission_rate: "number",
  contract_start_date: "date",
  contract_end_date: "date",
};

/** Contract status labels */
const STATUS_LABELS: Record<ContractStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending Review",
  CONFIRMED: "Confirmed",
  SENT: "Sent for Signing",
  SIGNED: "Signed",
  CANCELED: "Canceled",
};

/** 需要 textarea 的字段 */
const TEXTAREA_FIELDS: ReadonlyArray<keyof ContractFields> = [
  "covered_properties",
];

export function ContractEditForm({
  contractId,
  initialFields,
  supplierInfo,
  contractStatus,
}: ContractEditFormProps) {
  // 自动预填：仅当字段为空时从供应商信息填充
  const prefilled = useMemo<Partial<ContractFields>>(() => {
    const result = { ...initialFields };
    if (!result.partner_company_name?.trim()) {
      result.partner_company_name = supplierInfo.company_name;
    }
    if (!result.partner_city?.trim() && supplierInfo.city) {
      result.partner_city = supplierInfo.city;
    }
    return result;
  }, [initialFields, supplierInfo]);

  const [fields, setFields] = useState<Partial<ContractFields>>(prefilled);
  const [status, setStatus] = useState<ContractStatus>(contractStatus);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const isEditable = status === "DRAFT";

  const handleFieldChange = useCallback(
    (key: keyof ContractFields, value: string) => {
      setFields((prev) => ({ ...prev, [key]: value }));
      // 清除该字段的错误
      setErrors((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [],
  );

  /** 保存合同字段 */
  const handleSave = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    setErrors({});

    try {
      const res = await fetch(`/api/admin/contracts/${contractId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.fields) {
          setErrors(data.fields);
        }
        setMessage({ type: "error", text: data.error ?? "Save failed" });
        return;
      }

      setMessage({ type: "success", text: "Contract fields saved" });
    } catch {
      setMessage({ type: "error", text: "Network error, please try again" });
    } finally {
      setSaving(false);
    }
  }, [contractId, fields]);

  /** Push for review */
  const handlePushForReview = useCallback(async () => {
    setPushing(true);
    setMessage(null);
    setErrors({});

    try {
      // 先保存最新字段
      const saveRes = await fetch(`/api/admin/contracts/${contractId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });

      if (!saveRes.ok) {
        const saveData = await saveRes.json();
        if (saveData.fields) setErrors(saveData.fields);
        setMessage({ type: "error", text: saveData.error ?? "Save failed" });
        return;
      }

      // 推送审阅
      const res = await fetch(`/api/admin/contracts/${contractId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.fields) setErrors(data.fields);
        setMessage({ type: "error", text: data.error ?? "Push for review failed" });
        return;
      }

      setStatus("PENDING_REVIEW");
      setMessage({ type: "success", text: "Contract pushed for review" });
    } catch {
      setMessage({ type: "error", text: "Network error, please try again" });
    } finally {
      setPushing(false);
    }
  }, [contractId, fields]);

  return (
    <div className="rounded-lg border border-[var(--color-border)] p-4 md:p-6">
      {/* 状态提示 */}
      {!isEditable && (
        <div className="mb-4 rounded-md bg-[var(--color-bg-secondary)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
          Current contract status is &quot;{STATUS_LABELS[status]}&quot;, editing is disabled.
        </div>
      )}

      {/* 全局消息 */}
      {message && (
        <div
          className={`mb-4 rounded-md px-4 py-3 text-sm ${
            message.type === "success"
              ? "bg-[var(--color-success-light)] text-[var(--color-success)]"
              : "bg-[var(--color-primary-light)] text-[var(--color-primary)]"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 表单字段 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CONTRACT_FIELD_KEYS.map((key) => {
          const isTextarea = TEXTAREA_FIELDS.includes(key);
          const inputType = FIELD_INPUT_TYPES[key] ?? "text";
          const value = fields[key] ?? "";
          const error = errors[key];

          return (
            <div key={key} className={isTextarea ? "md:col-span-2" : ""}>
              <label
                htmlFor={`field-${key}`}
                className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
              >
                {FIELD_LABELS[key]}
              </label>

              {isTextarea ? (
                <textarea
                  id={`field-${key}`}
                  value={value}
                  onChange={(e) => handleFieldChange(key, e.target.value)}
                  disabled={!isEditable}
                  rows={3}
                  className={`w-full rounded-md border px-3 py-2 text-sm text-[var(--color-text-primary)] bg-[var(--color-bg-primary)] disabled:bg-[var(--color-bg-secondary)] disabled:cursor-not-allowed ${
                    error
                      ? "border-[var(--color-primary)]"
                      : "border-[var(--color-border)]"
                  } focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]`}
                />
              ) : (
                <input
                  id={`field-${key}`}
                  type={inputType}
                  value={value}
                  onChange={(e) => handleFieldChange(key, e.target.value)}
                  disabled={!isEditable}
                  step={inputType === "number" ? "0.01" : undefined}
                  min={inputType === "number" ? "0" : undefined}
                  max={inputType === "number" ? "100" : undefined}
                  className={`w-full rounded-md border px-3 py-2 text-sm text-[var(--color-text-primary)] bg-[var(--color-bg-primary)] disabled:bg-[var(--color-bg-secondary)] disabled:cursor-not-allowed ${
                    error
                      ? "border-[var(--color-primary)]"
                      : "border-[var(--color-border)]"
                  } focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]`}
                />
              )}

              {error && (
                <p className="mt-1 text-xs text-[var(--color-primary)]">
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* 操作按钮 */}
      {isEditable && (
        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || pushing}
            className="px-4 py-2 rounded-md border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-primary)] bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-secondary)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save"}
          </button>

          <button
            type="button"
            onClick={handlePushForReview}
            disabled={saving || pushing}
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pushing ? "Pushing..." : "Push for Review"}
          </button>
        </div>
      )}
    </div>
  );
}

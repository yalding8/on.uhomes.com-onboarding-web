"use client";

/**
 * 合同编辑表单 — Client Component
 *
 * DRAFT 状态：可编辑所有字段，保存 + 推送审阅按钮
 * 非 DRAFT 状态：只读模式，显示当前状态
 * 自动预填 partner_company_name 和 partner_city（仅当字段为空时）
 */

import { useState, useCallback, useMemo } from "react";
import { Eye, Pencil } from "lucide-react";
import type { ContractFields, ContractStatus } from "@/lib/contracts/types";
import { ContractDocumentPreview } from "@/components/contracts/ContractDocumentPreview";
import { ContractFieldGrid } from "./ContractFieldGrid";

export interface ContractEditFormProps {
  contractId: string;
  initialFields: Partial<ContractFields>;
  supplierInfo: { company_name: string; city: string | null };
  contractStatus: ContractStatus;
}

const STATUS_LABELS: Record<ContractStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending Review",
  CONFIRMED: "Confirmed",
  SENT: "Sent for Signing",
  SIGNED: "Signed",
  CANCELED: "Canceled",
};

export function ContractEditForm({
  contractId,
  initialFields,
  supplierInfo,
  contractStatus,
}: ContractEditFormProps) {
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
  const [showPreview, setShowPreview] = useState(false);

  const isEditable = status === "DRAFT";

  const handleFieldChange = useCallback(
    (key: keyof ContractFields, value: string) => {
      setFields((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [],
  );

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
        if (data.fields) setErrors(data.fields);
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

  const handlePushForReview = useCallback(async () => {
    setPushing(true);
    setMessage(null);
    setErrors({});
    try {
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
      const res = await fetch(`/api/admin/contracts/${contractId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.fields) setErrors(data.fields);
        setMessage({
          type: "error",
          text: data.error ?? "Push for review failed",
        });
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
      {!isEditable && (
        <div className="mb-4 rounded-md bg-[var(--color-bg-secondary)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
          Current contract status is &quot;{STATUS_LABELS[status]}&quot;,
          editing is disabled.
        </div>
      )}

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

      {/* Edit / Preview toggle */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setShowPreview(false)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            !showPreview
              ? "bg-[var(--color-primary)] text-white"
              : "border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
          }`}
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </button>
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            showPreview
              ? "bg-[var(--color-primary)] text-white"
              : "border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          Preview
        </button>
      </div>

      {showPreview ? (
        <ContractDocumentPreview fields={fields} />
      ) : (
        <ContractFieldGrid
          fields={fields}
          errors={errors}
          isEditable={isEditable}
          onFieldChange={handleFieldChange}
        />
      )}

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

"use client";

/**
 * 审批确认对话框 — Client Component
 *
 * 展示申请详情、合同类型选择、确认/取消操作。
 * - 非 PENDING 状态禁用审批按钮
 * - loading 状态防止重复提交
 * - 支持 Escape 关闭、点击遮罩关闭
 *
 * Requirements: 4.1, 4.3, 4.5
 */

import { useState, useEffect, useCallback } from "react";
import type { ApplicationRow } from "@/app/admin/applications/page";

export interface ApproveDialogProps {
  application: ApplicationRow;
  onConfirm: (contractType: string) => Promise<void>;
  onCancel: () => void;
}

export const CONTRACT_TYPES = [
  { value: "STANDARD_PROMOTION_2026", label: "Standard Promotion 2026" },
  { value: "PREMIUM_PROMOTION_2026", label: "Premium Promotion 2026" },
  { value: "CUSTOM", label: "Custom Contract" },
] as const;

export type ContractTypeValue = (typeof CONTRACT_TYPES)[number]["value"];

const STATUS_LABELS: Record<ApplicationRow["status"], string> = {
  PENDING: "Pending",
  CONVERTED: "Converted",
  REJECTED: "Rejected",
};

export function ApproveDialog({
  application,
  onConfirm,
  onCancel,
}: ApproveDialogProps) {
  const [contractType, setContractType] = useState<ContractTypeValue>(
    "STANDARD_PROMOTION_2026",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPending = application.status === "PENDING";

  // Escape 键关闭
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) {
        onCancel();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, loading]);

  const handleConfirm = useCallback(async () => {
    if (!isPending || loading) return;
    setLoading(true);
    setError(null);
    try {
      await onConfirm(contractType);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Operation failed, please try again";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [isPending, loading, onConfirm, contractType]);

  // 点击遮罩关闭
  const handleBackdropClick = useCallback(() => {
    if (!loading) {
      onCancel();
    }
  }, [loading, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="approve-dialog-title"
    >
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* 对话框 */}
      <div
        className="relative w-full max-w-md mx-4 rounded-lg bg-[var(--color-bg-primary)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="px-6 pt-6 pb-4 border-b border-[var(--color-border)]">
          <h2
            id="approve-dialog-title"
            className="text-lg font-semibold text-[var(--color-text-primary)]"
          >
            Approve Application
          </h2>
          {!isPending && (
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Current status is &quot;{STATUS_LABELS[application.status]}&quot;,
              cannot approve
            </p>
          )}
        </div>

        {/* 申请详情 */}
        <div className="px-6 py-4 space-y-3">
          <DetailRow label="Company" value={application.company_name} />
          <DetailRow label="Email" value={application.contact_email} />
          <DetailRow label="Phone" value={application.contact_phone ?? "—"} />
          <DetailRow label="City" value={application.city ?? "—"} />
          <DetailRow
            label="Country / Region"
            value={application.country ?? "—"}
          />

          {/* 合同类型选择 */}
          <div className="pt-2">
            <label
              htmlFor="contract-type"
              className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
            >
              Contract Type
            </label>
            <select
              id="contract-type"
              value={contractType}
              onChange={(e) =>
                setContractType(e.target.value as ContractTypeValue)
              }
              disabled={!isPending || loading}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {CONTRACT_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* 错误提示 */}
          {error && (
            <p
              role="alert"
              className="text-sm text-[var(--color-warning)] bg-[var(--color-warning-light)] rounded px-3 py-2"
            >
              {error}
            </p>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="px-6 pb-6 pt-2 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-md text-sm font-medium text-[var(--color-text-secondary)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-border)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isPending || loading}
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && <LoadingSpinner />}
            {isPending ? "Confirm Approval" : STATUS_LABELS[application.status]}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex text-sm">
      <span className="w-20 shrink-0 text-[var(--color-text-muted)]">
        {label}
      </span>
      <span className="text-[var(--color-text-primary)]">{value}</span>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

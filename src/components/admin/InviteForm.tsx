"use client";

import { useState } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { SUPPLIER_TYPES } from "@/lib/constants/supplier-types";
import { ContractFieldGrid } from "./ContractFieldGrid";
import type { ContractFields } from "@/lib/contracts/types";
import {
  validateInviteForm,
  INITIAL_FORM,
  type InviteFormData,
  type InviteFormErrors,
} from "./invite-form-utils";

export { validateInviteForm } from "./invite-form-utils";

export function InviteForm() {
  const [form, setForm] = useState<InviteFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<InviteFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [showContractFields, setShowContractFields] = useState(false);
  const [contractFields, setContractFields] = useState<Partial<ContractFields>>(
    {},
  );

  const handleChange = (field: keyof InviteFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // 清除该字段的错误
    if (errors[field as keyof InviteFormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    // 清除上次提交结果
    if (result) setResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validateInviteForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setResult(null);

    try {
      // Include contractFields only if any field has a value
      const hasContractFields = Object.values(contractFields).some(
        (v) => v && v.trim(),
      );
      const payload = hasContractFields
        ? { ...form, contractFields }
        : { ...form };

      const response = await fetch("/api/admin/invite-supplier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setResult({
          type: "error",
          message: data.error || "Operation failed, please try again",
        });
        return;
      }

      setResult({ type: "success", message: "Invitation sent successfully" });
      setForm(INITIAL_FORM);
      setContractFields({});
      setShowContractFields(false);
    } catch {
      setResult({
        type: "error",
        message: "Operation failed, please try again",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-lg rounded-lg border border-[var(--color-border)] p-4 md:p-6"
    >
      {/* 结果提示 — 双编码：图标 + 颜色 */}
      {result && (
        <div
          role="alert"
          className={`mb-4 px-4 py-3 rounded-lg text-sm flex items-center gap-2 ${
            result.type === "success"
              ? "bg-[var(--color-success-light)] text-[var(--color-success)]"
              : "bg-[var(--color-warning-light)] text-[var(--color-warning)]"
          }`}
        >
          {result.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {result.message}
        </div>
      )}

      {/* 邮箱 */}
      <div className="mb-4">
        <label
          htmlFor="invite-email"
          className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
        >
          Email <span className="text-[var(--color-primary)]">*</span>
        </label>
        <input
          id="invite-email"
          type="email"
          value={form.email}
          onChange={(e) => handleChange("email", e.target.value)}
          placeholder="supplier@example.com"
          className={`w-full px-3 py-2 rounded-lg border text-sm bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] ${
            errors.email
              ? "border-[var(--color-warning)]"
              : "border-[var(--color-border)]"
          } focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]`}
        />
        {errors.email && (
          <p className="mt-1 text-xs text-[var(--color-warning)]">
            {errors.email}
          </p>
        )}
      </div>

      {/* 公司名称 */}
      <div className="mb-4">
        <label
          htmlFor="invite-company"
          className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
        >
          Company Name <span className="text-[var(--color-primary)]">*</span>
        </label>
        <input
          id="invite-company"
          type="text"
          value={form.company_name}
          onChange={(e) => handleChange("company_name", e.target.value)}
          placeholder="Full company name"
          className={`w-full px-3 py-2 rounded-lg border text-sm bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] ${
            errors.company_name
              ? "border-[var(--color-warning)]"
              : "border-[var(--color-border)]"
          } focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]`}
        />
        {errors.company_name && (
          <p className="mt-1 text-xs text-[var(--color-warning)]">
            {errors.company_name}
          </p>
        )}
      </div>

      {/* 供应商类型 */}
      <div className="mb-4">
        <label
          htmlFor="invite-supplier-type"
          className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
        >
          Supplier Type <span className="text-[var(--color-primary)]">*</span>
        </label>
        <div className="relative">
          <select
            id="invite-supplier-type"
            value={form.supplier_type}
            onChange={(e) => handleChange("supplier_type", e.target.value)}
            className={`w-full px-3 py-2 pe-8 rounded-lg border text-sm bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] appearance-none ${
              errors.supplier_type
                ? "border-[var(--color-warning)]"
                : "border-[var(--color-border)]"
            } focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]`}
          >
            <option value="" disabled>
              Select supplier type
            </option>
            {SUPPLIER_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 end-0 pe-2 flex items-center pointer-events-none">
            <ChevronDown className="h-4 w-4 text-[var(--color-text-muted)]" />
          </div>
        </div>
        {errors.supplier_type && (
          <p className="mt-1 text-xs text-[var(--color-warning)]">
            {errors.supplier_type}
          </p>
        )}
      </div>

      {/* 电话 */}
      <div className="mb-4">
        <label
          htmlFor="invite-phone"
          className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
        >
          Phone
        </label>
        <input
          id="invite-phone"
          type="tel"
          value={form.phone}
          onChange={(e) => handleChange("phone", e.target.value)}
          placeholder="+44 20 1234 5678"
          className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
      </div>

      {/* 网站 */}
      <div className="mb-6">
        <label
          htmlFor="invite-website"
          className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
        >
          Website
        </label>
        <input
          id="invite-website"
          type="url"
          value={form.website}
          onChange={(e) => handleChange("website", e.target.value)}
          placeholder="https://example.com"
          className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
      </div>

      {/* 合同字段预填（可选） */}
      <div className="mb-6 border border-[var(--color-border)] rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowContractFields(!showContractFields)}
          className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
        >
          <span>Pre-fill Contract Fields (Optional)</span>
          {showContractFields ? (
            <ChevronDown className="h-4 w-4 text-[var(--color-text-muted)]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[var(--color-text-muted)]" />
          )}
        </button>
        {showContractFields && (
          <div className="p-4 border-t border-[var(--color-border)]">
            <p className="text-xs text-[var(--color-text-secondary)] mb-3">
              Pre-filled fields will skip the DRAFT stage — contract goes
              directly to Pending Review.
            </p>
            <ContractFieldGrid
              fields={contractFields}
              errors={{}}
              isEditable={true}
              onFieldChange={(key, value) =>
                setContractFields((prev) => ({ ...prev, [key]: value }))
              }
            />
          </div>
        )}
      </div>

      {/* 提交按钮 */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitting ? "Sending..." : "Send Invitation"}
      </button>
    </form>
  );
}

"use client";

/**
 * 邀请供应商表单 — Client Component
 *
 * 表单字段：邮箱（必填）、公司名称（必填）、电话（选填）、城市（选填）、网站（选填）
 * 前端验证 + 提交后显示成功/错误提示。
 *
 * Requirements: 8.1, 8.2, 8.5
 */

import { useState } from "react";

interface FormData {
  email: string;
  company_name: string;
  phone: string;
  city: string;
  website: string;
}

interface FormErrors {
  email?: string;
  company_name?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INITIAL_FORM: FormData = {
  email: "",
  company_name: "",
  phone: "",
  city: "",
  website: "",
};

/** 前端表单验证 */
export function validateInviteForm(data: FormData): FormErrors {
  const errors: FormErrors = {};
  if (!data.email.trim()) {
    errors.email = "Email is required";
  } else if (!EMAIL_REGEX.test(data.email.trim())) {
    errors.email = "Invalid email format";
  }
  if (!data.company_name.trim()) {
    errors.company_name = "Company name is required";
  }
  return errors;
}

export function InviteForm() {
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleChange = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // 清除该字段的错误
    if (errors[field as keyof FormErrors]) {
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
      const response = await fetch("/api/admin/invite-supplier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
    } catch {
      setResult({ type: "error", message: "Operation failed, please try again" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-lg rounded-lg border border-[var(--color-border)] p-4 md:p-6"
    >
      {/* 结果提示 */}
      {result && (
        <div
          role="alert"
          className={`mb-4 px-4 py-3 rounded text-sm ${
            result.type === "success"
              ? "bg-[var(--color-success-light)] text-[var(--color-success)]"
              : "bg-[var(--color-primary-light)] text-[var(--color-primary)]"
          }`}
        >
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
              ? "border-[var(--color-primary)]"
              : "border-[var(--color-border)]"
          } focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]`}
        />
        {errors.email && (
          <p className="mt-1 text-xs text-[var(--color-primary)]">
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
              ? "border-[var(--color-primary)]"
              : "border-[var(--color-border)]"
          } focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]`}
        />
        {errors.company_name && (
          <p className="mt-1 text-xs text-[var(--color-primary)]">
            {errors.company_name}
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
          placeholder="Optional"
          className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
      </div>

      {/* 城市 */}
      <div className="mb-4">
        <label
          htmlFor="invite-city"
          className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
        >
          City
        </label>
        <input
          id="invite-city"
          type="text"
          value={form.city}
          onChange={(e) => handleChange("city", e.target.value)}
          placeholder="Optional"
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

      {/* 提交按钮 */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? "Sending..." : "Send Invitation"}
      </button>
    </form>
  );
}

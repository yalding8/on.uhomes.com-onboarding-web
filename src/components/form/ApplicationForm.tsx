"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  Mail,
  Globe,
  ArrowRight,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { PhoneInput } from "@/components/form/PhoneInput";
import { ApplicationSuccess } from "@/components/form/ApplicationSuccess";
import { SUPPLIER_TYPES } from "@/lib/constants/supplier-types";

// Schema corresponding exactly to PRD section 3.4
const applicantSchema = z.object({
  company_name: z.string().min(2, "Company Name is required"),
  supplier_type: z.string().min(1, "Supplier Type is required"),
  contact_email: z.string().email("Valid work email is required"),
  contact_phone: z
    .string()
    .regex(
      /^\+\d{1,4}[\s\-]?\d[\d\s\-]{3,15}$/,
      "Please select a country/region code and enter your phone number",
    ),
  country: z
    .string()
    .min(2, "Please enter the full country name (e.g. United Kingdom)"),
  website_url: z
    .string()
    .transform((val) => {
      if (!val) return val;
      if (!/^https?:\/\//i.test(val)) return `https://${val}`;
      return val;
    })
    .pipe(
      z
        .string()
        .url("Please enter a valid URL")
        .refine((val) => /^https?:\/\//i.test(val), {
          message: "Only http:// and https:// URLs are allowed",
        }),
    )
    .optional()
    .or(z.literal("")),
});

type ApplicantFormValues = z.infer<typeof applicantSchema>;

interface ApplicationFormProps {
  prefillEmail?: string | null;
  referralCode?: string | null;
}

export function ApplicationForm({
  prefillEmail,
  referralCode,
}: ApplicationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ApplicantFormValues>({
    resolver: zodResolver(applicantSchema),
    defaultValues: {
      company_name: "",
      supplier_type: "",
      contact_email: prefillEmail || "",
      contact_phone: "",
      country: "",
      website_url: "",
    },
  });

  const onSubmit = async (data: ApplicantFormValues) => {
    setIsSubmitting(true);
    setSubmitError("");

    try {
      const response = await fetch("/api/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          ...(referralCode ? { referral_code: referralCode } : {}),
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to submit application");
      }

      setIsSuccess(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setSubmitError(err.message || "An unexpected error occurred.");
      } else {
        setSubmitError("An unexpected error occurred.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return <ApplicationSuccess showSignIn={!prefillEmail} />;
  }

  return (
    <div className="w-full max-w-xl mx-auto bg-[var(--color-bg-primary)] rounded-2xl shadow-xl overflow-hidden border border-[var(--color-border)] text-start">
      <div className="bg-[var(--color-bg-secondary)] px-8 py-6 border-b border-[var(--color-border)]">
        <h3 className="text-xl font-semibold text-[var(--color-text-primary)] text-center">
          Become a Supplier
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)] text-center mt-1">
          {prefillEmail
            ? "Complete your company details to get started."
            : "Fill out the form below to get early access."}
        </p>

        {submitError && (
          <div className="mt-4 p-3 rounded-lg bg-[var(--color-warning-light)] text-[var(--color-warning)] text-sm font-medium border border-[var(--color-warning)]/20 text-center">
            {submitError}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
        {/* Company Name */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
            Company Name *
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
              <Building2 className="h-5 w-5 text-[var(--color-text-muted)]" />
            </div>
            <input
              {...register("company_name")}
              disabled={isSubmitting}
              className={`block w-full rounded-lg border ${errors.company_name ? "border-[var(--color-warning)]" : "border-[var(--color-border)]"} ps-10 px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition-colors`}
              placeholder="Your Property Management LLC"
            />
          </div>
          {errors.company_name && (
            <p className="text-[var(--color-warning)] text-xs mt-1">
              {errors.company_name.message}
            </p>
          )}
        </div>

        {/* Supplier Type */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
            Supplier Type *
          </label>
          <div className="relative">
            <select
              {...register("supplier_type")}
              disabled={isSubmitting}
              className={`block w-full rounded-lg border ${errors.supplier_type ? "border-[var(--color-warning)]" : "border-[var(--color-border)]"} px-4 py-3 pe-10 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition-colors appearance-none bg-transparent`}
              defaultValue=""
            >
              <option value="" disabled>
                Select your supplier type
              </option>
              {SUPPLIER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 end-0 pe-3 flex items-center pointer-events-none">
              <ChevronDown className="h-4 w-4 text-[var(--color-text-muted)]" />
            </div>
          </div>
          {errors.supplier_type && (
            <p className="text-[var(--color-warning)] text-xs mt-1">
              {errors.supplier_type.message}
            </p>
          )}
        </div>

        {/* Work Email */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
            Work Email *
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-[var(--color-text-muted)]" />
            </div>
            <input
              {...register("contact_email")}
              type="email"
              readOnly={!!prefillEmail}
              disabled={isSubmitting}
              className={`block w-full rounded-lg border ${errors.contact_email ? "border-[var(--color-warning)]" : "border-[var(--color-border)]"} ps-10 px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition-colors ${prefillEmail ? "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] cursor-not-allowed" : ""}`}
              placeholder="hello@example.com"
            />
          </div>
          {errors.contact_email && (
            <p className="text-[var(--color-warning)] text-xs mt-1">
              {errors.contact_email.message}
            </p>
          )}
        </div>

        {/* Contact Phone */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
            Contact Phone *
          </label>
          <Controller
            name="contact_phone"
            control={control}
            render={({ field }) => (
              <PhoneInput
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={isSubmitting}
                error={!!errors.contact_phone}
              />
            )}
          />
          {errors.contact_phone && (
            <p className="text-[var(--color-warning)] text-xs mt-1">
              {errors.contact_phone.message}
            </p>
          )}
        </div>

        {/* Country / Region */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
            Country / Region *
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
              <Globe className="h-5 w-5 text-[var(--color-text-muted)]" />
            </div>
            <input
              {...register("country")}
              disabled={isSubmitting}
              className={`block w-full rounded-lg border ${errors.country ? "border-[var(--color-warning)]" : "border-[var(--color-border)]"} ps-10 px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition-colors`}
              placeholder="e.g. United Kingdom"
            />
          </div>
          {errors.country && (
            <p className="text-[var(--color-warning)] text-xs mt-1">
              {errors.country.message}
            </p>
          )}
        </div>

        {/* Website (Optional) */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
            Website URL{" "}
            <span className="text-[var(--color-text-muted)] font-normal">
              (Optional)
            </span>
          </label>
          <input
            {...register("website_url")}
            disabled={isSubmitting}
            className={`block w-full rounded-lg border ${errors.website_url ? "border-[var(--color-warning)]" : "border-[var(--color-border)]"} px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition-colors`}
            placeholder="https://www.example.com"
          />
          {errors.website_url && (
            <p className="text-[var(--color-warning)] text-xs mt-1">
              {errors.website_url.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-4 flex w-full items-center justify-center rounded-lg bg-[var(--color-primary)] px-4 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 active:scale-[0.98] transition-all disabled:opacity-70"
        >
          {isSubmitting ? (
            <Loader2 className="me-2 h-5 w-5 animate-spin" />
          ) : (
            <>
              Submit Request
              <ArrowRight className="ms-2 h-5 w-5" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  Mail,
  Globe,
  ArrowRight,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { PhoneInput } from "@/components/form/PhoneInput";

// Schema corresponding exactly to PRD section 3.4
const applicantSchema = z.object({
  company_name: z.string().min(2, "Company Name is required"),
  contact_email: z.string().email("Valid work email is required"),
  contact_phone: z
    .string()
    .regex(
      /^\+\d{1,4}\s\d{4,14}$/,
      "Please select a country/region code and enter your phone number",
    ),
  city: z.string().min(2, "City is required"),
  country: z.string().min(2, "Country / Region is required"),
  website_url: z
    .string()
    .transform((val) => {
      if (!val) return val;
      if (!/^https?:\/\//i.test(val)) return `https://${val}`;
      return val;
    })
    .pipe(z.string().url("Please enter a valid URL"))
    .optional()
    .or(z.literal("")),
});

type ApplicantFormValues = z.infer<typeof applicantSchema>;

export function ApplicationForm() {
  const router = useRouter();
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
      contact_email: "",
      contact_phone: "",
      city: "",
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
        body: JSON.stringify(data),
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
    return (
      <div className="w-full max-w-xl mx-auto bg-[var(--color-bg-primary)] p-8 md:p-12 rounded-2xl shadow-xl text-center border border-[var(--color-border)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-success)]/10 mb-6">
          <CheckCircle2 className="h-8 w-8 text-[var(--color-success)]" />
        </div>
        <h3 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">
          Application Received!
        </h3>
        <p className="text-[var(--color-text-secondary)] mb-8">
          Thank you for showing interest in uhomes. Our Business Development
          team will review your application and contact you via email shortly.
        </p>
        <button
          onClick={() => {
            setIsSuccess(false);
            router.refresh();
          }}
          className="text-[var(--color-primary)] font-medium hover:text-[var(--color-primary-hover)] transition-colors"
        >
          Submit another application
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto bg-[var(--color-bg-primary)] rounded-2xl shadow-xl overflow-hidden border border-[var(--color-border)] text-left">
      <div className="bg-[var(--color-bg-secondary)] px-8 py-6 border-b border-[var(--color-border)]">
        <h3 className="text-xl font-semibold text-[var(--color-text-primary)] text-center">
          Become a Supplier
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)] text-center mt-1">
          Fill out the form below to get early access.
        </p>

        {submitError && (
          <div className="mt-4 p-3 rounded-lg bg-[var(--color-primary-light)] text-[var(--color-primary)] text-sm font-medium border border-[var(--color-primary)]/20 text-center">
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
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Building2 className="h-5 w-5 text-[var(--color-text-muted)]" />
            </div>
            <input
              {...register("company_name")}
              disabled={isSubmitting}
              className={`block w-full rounded-lg border ${errors.company_name ? "border-[var(--color-primary)]" : "border-[var(--color-border)]"} pl-10 px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition-colors`}
              placeholder="Your Property Management LLC"
            />
          </div>
          {errors.company_name && (
            <p className="text-[var(--color-primary)] text-xs mt-1">
              {errors.company_name.message}
            </p>
          )}
        </div>

        {/* Email & Phone Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Work Email *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-[var(--color-text-muted)]" />
              </div>
              <input
                {...register("contact_email")}
                type="email"
                disabled={isSubmitting}
                className={`block w-full rounded-lg border ${errors.contact_email ? "border-[var(--color-primary)]" : "border-[var(--color-border)]"} pl-10 px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition-colors`}
                placeholder="hello@example.com"
              />
            </div>
            {errors.contact_email && (
              <p className="text-[var(--color-primary)] text-xs mt-1">
                {errors.contact_email.message}
              </p>
            )}
          </div>

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
              <p className="text-[var(--color-primary)] text-xs mt-1">
                {errors.contact_phone.message}
              </p>
            )}
          </div>
        </div>

        {/* City & Country / Region Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              City *
            </label>
            <input
              {...register("city")}
              disabled={isSubmitting}
              className={`block w-full rounded-lg border ${errors.city ? "border-[var(--color-primary)]" : "border-[var(--color-border)]"} px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition-colors`}
              placeholder="e.g. London"
            />
            {errors.city && (
              <p className="text-[var(--color-primary)] text-xs mt-1">
                {errors.city.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Country / Region *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Globe className="h-5 w-5 text-[var(--color-text-muted)]" />
              </div>
              <input
                {...register("country")}
                disabled={isSubmitting}
                className={`block w-full rounded-lg border ${errors.country ? "border-[var(--color-primary)]" : "border-[var(--color-border)]"} pl-10 px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition-colors`}
                placeholder="e.g. United Kingdom"
              />
            </div>
            {errors.country && (
              <p className="text-[var(--color-primary)] text-xs mt-1">
                {errors.country.message}
              </p>
            )}
          </div>
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
            className={`block w-full rounded-lg border ${errors.website_url ? "border-[var(--color-primary)]" : "border-[var(--color-border)]"} px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition-colors`}
            placeholder="https://www.example.com"
          />
          {errors.website_url && (
            <p className="text-[var(--color-primary)] text-xs mt-1">
              {errors.website_url.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-4 flex w-full items-center justify-center rounded-lg bg-[var(--color-primary)] px-4 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 transition-colors disabled:opacity-70"
        >
          {isSubmitting ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <>
              Submit Request
              <ArrowRight className="ml-2 h-5 w-5" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

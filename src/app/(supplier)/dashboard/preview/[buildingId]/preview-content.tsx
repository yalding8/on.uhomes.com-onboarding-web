"use client";

/**
 * Preview Content — client component for uhomes.com-style listing preview.
 *
 * P2-G6: Shows building data with placeholders for missing fields.
 */

import Link from "next/link";
import { ArrowLeft, MapPin, ImageIcon, AlertCircle } from "lucide-react";
import type { FieldValue } from "@/lib/onboarding/field-value";

interface PreviewContentProps {
  buildingId: string;
  fieldValues: Record<string, FieldValue>;
  score: number;
  missingCount: number;
}

function getVal(fv: Record<string, FieldValue>, key: string): string | null {
  const v = fv[key]?.value;
  if (v === null || v === undefined) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  if (Array.isArray(v)) return v.length > 0 ? v.join(", ") : null;
  return String(v);
}

function Placeholder({ text }: { text: string }) {
  return <span className="text-sm italic text-gray-400">{text}</span>;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="mb-3 text-base font-semibold text-gray-900">{title}</h3>
      {children}
    </div>
  );
}

export default function PreviewContent({
  buildingId,
  fieldValues,
  score,
  missingCount,
}: PreviewContentProps) {
  const name = getVal(fieldValues, "building_name");
  const address = getVal(fieldValues, "building_address");
  const city = getVal(fieldValues, "city");
  const country = getVal(fieldValues, "country");
  const description = getVal(fieldValues, "description");
  const coverImage = getVal(fieldValues, "cover_image");
  const priceMin = getVal(fieldValues, "price_min");
  const priceMax = getVal(fieldValues, "price_max");
  const currency = getVal(fieldValues, "currency") ?? "USD";
  const rentPeriod = getVal(fieldValues, "rent_period") ?? "Monthly";
  const amenities = getVal(fieldValues, "key_amenities");
  const unitTypes = getVal(fieldValues, "unit_types_summary");
  const leaseDuration = getVal(fieldValues, "lease_duration");
  const moveInDates = getVal(fieldValues, "move_in_dates");
  const cancellation = getVal(fieldValues, "cancellation_policy");
  const appFee = getVal(fieldValues, "application_fee");
  const depositIntl = getVal(fieldValues, "deposit_intl");
  const utilities = getVal(fieldValues, "utilities_included");
  const contactName = getVal(fieldValues, "primary_contact_name");
  const contactEmail = getVal(fieldValues, "primary_contact_email");

  const priceDisplay =
    priceMin && priceMax
      ? `${currency} ${priceMin} – ${priceMax} / ${rentPeriod.toLowerCase()}`
      : null;

  const scoreColor =
    score >= 70
      ? "text-green-600"
      : score >= 40
        ? "text-yellow-600"
        : "text-red-600";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      {/* Hero image */}
      <div className="mb-6 overflow-hidden rounded-xl bg-gray-100">
        {coverImage ? (
          <img
            src={coverImage}
            alt={name ?? "Property"}
            className="h-64 w-full object-cover sm:h-80"
          />
        ) : (
          <div className="flex h-64 flex-col items-center justify-center gap-2 sm:h-80">
            <ImageIcon className="h-12 w-12 text-gray-300" />
            <Placeholder text="Add a cover photo to make your listing stand out" />
          </div>
        )}
      </div>

      {/* Title + price */}
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {name ?? <Placeholder text="Property name not set" />}
          </h1>
          {address || city || country ? (
            <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
              <MapPin className="h-4 w-4" />
              {[address, city, country].filter(Boolean).join(", ")}
            </p>
          ) : (
            <p className="mt-1 text-sm">
              <Placeholder text="Address not provided" />
            </p>
          )}
        </div>
        <div className="mt-2 text-end sm:mt-0">
          {priceDisplay ? (
            <p className="text-xl font-bold text-[var(--color-primary)]">
              {priceDisplay}
            </p>
          ) : (
            <Placeholder text="Price not set" />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* Amenities */}
        <Section title="Key Amenities">
          {amenities ? (
            <div className="flex flex-wrap gap-2">
              {amenities.split(", ").map((a) => (
                <span
                  key={a}
                  className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
                >
                  {a}
                </span>
              ))}
            </div>
          ) : (
            <Placeholder text="No amenities added yet" />
          )}
        </Section>

        {/* Description */}
        <Section title="Description">
          {description ? (
            <p className="text-sm leading-relaxed text-gray-600">
              {description}
            </p>
          ) : (
            <Placeholder text="No description yet — add one to improve your listing" />
          )}
        </Section>

        {/* Unit types */}
        <Section title="Unit Types">
          {unitTypes ? (
            <p className="text-sm text-gray-600">{unitTypes}</p>
          ) : (
            <Placeholder text="Unit type information not provided" />
          )}
        </Section>

        {/* Lease info */}
        <Section title="Lease Information">
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              <span className="font-medium text-gray-800">Duration:</span>{" "}
              {leaseDuration ?? <Placeholder text="—" />}
            </p>
            <p>
              <span className="font-medium text-gray-800">Move-in Dates:</span>{" "}
              {moveInDates ?? <Placeholder text="—" />}
            </p>
            <p>
              <span className="font-medium text-gray-800">Cancellation:</span>{" "}
              {cancellation ?? <Placeholder text="—" />}
            </p>
          </div>
        </Section>

        {/* Fees */}
        <Section title="Fees & Deposits">
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              <span className="font-medium text-gray-800">
                Application Fee:
              </span>{" "}
              {appFee ? `${currency} ${appFee}` : <Placeholder text="—" />}
            </p>
            <p>
              <span className="font-medium text-gray-800">Deposit:</span>{" "}
              {depositIntl ?? <Placeholder text="—" />}
            </p>
            <p>
              <span className="font-medium text-gray-800">Utilities:</span>{" "}
              {utilities ?? <Placeholder text="—" />}
            </p>
          </div>
        </Section>

        {/* Contact */}
        <Section title="Contact Information">
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              <span className="font-medium text-gray-800">Name:</span>{" "}
              {contactName ?? <Placeholder text="—" />}
            </p>
            <p>
              <span className="font-medium text-gray-800">Email:</span>{" "}
              {contactEmail ?? <Placeholder text="—" />}
            </p>
          </div>
        </Section>

        {/* Completion status */}
        <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-5">
          <div className="flex items-center gap-2">
            <AlertCircle className={`h-5 w-5 ${scoreColor}`} />
            <span className={`text-lg font-bold ${scoreColor}`}>
              {score}% complete
            </span>
            <span className="text-sm text-gray-500">
              — {missingCount} fields missing
            </span>
          </div>
          <Link
            href={`/onboarding/${buildingId}`}
            className="mt-3 inline-block rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Edit Property Details
          </Link>
        </div>
      </div>
    </div>
  );
}

import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

export type PhoneValidationResult = {
  valid: boolean;
  /** E.164 formatted number, e.g. "+61412345678" */
  e164: string | null;
  /** International formatted, e.g. "+61 4 1234 5678" */
  formatted: string | null;
  /** ISO 3166-1 alpha-2 country code, e.g. "AU" */
  countryCode: string | null;
};

/**
 * Validate and normalize an international phone number.
 * Uses Google's libphonenumber under the hood.
 *
 * @param phone - Raw phone string (with or without country prefix)
 * @param defaultCountry - Fallback country code if phone has no prefix
 */
export function validatePhone(
  phone: string,
  defaultCountry?: string,
): PhoneValidationResult {
  if (!phone || !phone.trim()) {
    return { valid: false, e164: null, formatted: null, countryCode: null };
  }

  const parsed = parsePhoneNumberFromString(
    phone,
    defaultCountry as CountryCode | undefined,
  );

  if (!parsed || !parsed.isValid()) {
    return { valid: false, e164: null, formatted: null, countryCode: null };
  }

  return {
    valid: true,
    e164: parsed.format("E.164"),
    formatted: parsed.formatInternational(),
    countryCode: parsed.country ?? null,
  };
}

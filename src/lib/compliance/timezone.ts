/**
 * Timezone awareness utilities.
 * All internal storage uses UTC; display layer converts per user timezone.
 */

/** Common IANA timezones by country (default for each market) */
const DEFAULT_TIMEZONES: Record<string, string> = {
  US: "America/New_York",
  CA: "America/Toronto",
  GB: "Europe/London",
  AU: "Australia/Sydney",
  NZ: "Pacific/Auckland",
  DE: "Europe/Berlin",
  FR: "Europe/Paris",
  NL: "Europe/Amsterdam",
  JP: "Asia/Tokyo",
  SG: "Asia/Singapore",
  HK: "Asia/Hong_Kong",
  MO: "Asia/Macau",
  IE: "Europe/Dublin",
  SE: "Europe/Stockholm",
  DK: "Europe/Copenhagen",
  NO: "Europe/Oslo",
  FI: "Europe/Helsinki",
  CH: "Europe/Zurich",
  BE: "Europe/Brussels",
  AT: "Europe/Vienna",
  IT: "Europe/Rome",
  ES: "Europe/Madrid",
  PT: "Europe/Lisbon",
};

/**
 * Get the default IANA timezone for a country code.
 * Falls back to "UTC" for unknown countries.
 */
export function getDefaultTimezone(countryCode: string): string {
  return DEFAULT_TIMEZONES[countryCode.toUpperCase()] ?? "UTC";
}

/**
 * Check if the current time is within business hours (9:00-18:00)
 * for the given timezone.
 */
export function isBusinessHours(timezone: string): boolean {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  });
  const hour = parseInt(formatter.format(now), 10);
  return hour >= 9 && hour < 18;
}

/**
 * Format a UTC Date to a localized string in the given timezone.
 */
export function formatInTimezone(
  date: Date,
  timezone: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
    ...options,
  }).format(date);
}

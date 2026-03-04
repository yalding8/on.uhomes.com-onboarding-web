/**
 * Cookie Consent management.
 * Three-tier consent model: Necessary (always on), Functional, Analytics.
 */

export type ConsentCategory = "necessary" | "functional" | "analytics";

export type ConsentState = Record<ConsentCategory, boolean>;

/** Key used in localStorage */
const CONSENT_STORAGE_KEY = "cookie_consent";

/** EU/UK countries that require explicit opt-in for Analytics */
const STRICT_CONSENT_COUNTRIES = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "GB",
  "NO",
  "IS",
  "LI",
  "CH",
]);

/**
 * Get default consent state based on user's country.
 * EU/UK: Analytics defaults OFF (GDPR opt-in required).
 * Others: Functional ON, Analytics OFF (best practice).
 */
export function getDefaultConsent(countryCode?: string): ConsentState {
  const isStrict =
    countryCode && STRICT_CONSENT_COUNTRIES.has(countryCode.toUpperCase());

  return {
    necessary: true, // Always on, cannot be disabled
    functional: isStrict ? false : true,
    analytics: false, // Always default off everywhere
  };
}

/**
 * Read persisted consent from localStorage.
 * Returns null if no consent has been recorded yet (first visit).
 */
export function readConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentState;
    // Ensure necessary is always true
    return { ...parsed, necessary: true };
  } catch {
    return null;
  }
}

/**
 * Persist consent choices to localStorage.
 */
export function saveConsent(state: ConsentState): void {
  if (typeof window === "undefined") return;
  const toSave: ConsentState = { ...state, necessary: true };
  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(toSave));
}

/**
 * Check if consent banner should be shown.
 * True if no consent record exists yet.
 */
export function shouldShowBanner(): boolean {
  return readConsent() === null;
}

/**
 * Accept all cookie categories.
 */
export function acceptAll(): ConsentState {
  const state: ConsentState = {
    necessary: true,
    functional: true,
    analytics: true,
  };
  saveConsent(state);
  return state;
}

/**
 * Accept only necessary cookies (reject optional).
 */
export function rejectOptional(): ConsentState {
  const state: ConsentState = {
    necessary: true,
    functional: false,
    analytics: false,
  };
  saveConsent(state);
  return state;
}

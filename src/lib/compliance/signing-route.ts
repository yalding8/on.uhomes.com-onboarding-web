/**
 * Determine the contract signing method based on supplier country.
 * DocuSign is used for verified markets; wet-ink fallback for others.
 */

export type SigningMethod = "docusign" | "wet_ink_upload";

/**
 * Countries where DocuSign electronic signatures are legally verified.
 * Covers all core target markets for on.uhomes.com.
 */
const DOCUSIGN_VERIFIED: ReadonlySet<string> = new Set([
  // English-speaking
  "US",
  "CA",
  "GB",
  "AU",
  "NZ",
  "IE",
  // Western Europe
  "DE",
  "FR",
  "NL",
  "BE",
  "AT",
  "CH",
  // Northern Europe
  "SE",
  "DK",
  "NO",
  "FI",
  // Asia-Pacific
  "HK",
  "MO",
  "SG",
  "JP",
  // Southern Europe
  "IT",
  "ES",
  "PT",
]);

/**
 * Get the signing method for a given country code (ISO 3166-1 alpha-2).
 *
 * - DocuSign: electronically valid in the country
 * - wet_ink_upload: supplier downloads PDF, signs manually, uploads scan
 */
export function getSigningMethod(countryCode: string): SigningMethod {
  if (DOCUSIGN_VERIFIED.has(countryCode.toUpperCase())) {
    return "docusign";
  }
  return "wet_ink_upload";
}

/**
 * Check whether a country has DocuSign legal validity.
 */
export function isDocuSignVerified(countryCode: string): boolean {
  return DOCUSIGN_VERIFIED.has(countryCode.toUpperCase());
}

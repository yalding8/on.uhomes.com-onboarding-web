/**
 * S2.1: Country-aware address formatting.
 * Formats structured address components into locale-correct display strings.
 */

export type AddressComponents = {
  street_number?: string;
  street_name?: string;
  unit_number?: string;
  city?: string;
  state_province?: string;
  postal_code?: string;
  country?: string;
};

/**
 * Address field ordering by country (ISO 3166-1 alpha-2).
 * Defines the display sequence of address components.
 */
const ADDRESS_FORMATS: Record<string, ReadonlyArray<keyof AddressComponents>> =
  {
    US: [
      "street_number",
      "street_name",
      "unit_number",
      "city",
      "state_province",
      "postal_code",
    ],
    CA: [
      "street_number",
      "street_name",
      "unit_number",
      "city",
      "state_province",
      "postal_code",
    ],
    UK: [
      "unit_number",
      "street_number",
      "street_name",
      "city",
      "state_province",
      "postal_code",
    ],
    GB: [
      "unit_number",
      "street_number",
      "street_name",
      "city",
      "state_province",
      "postal_code",
    ],
    AU: [
      "unit_number",
      "street_number",
      "street_name",
      "city",
      "state_province",
      "postal_code",
    ],
    NZ: [
      "unit_number",
      "street_number",
      "street_name",
      "city",
      "state_province",
      "postal_code",
    ],
    JP: [
      "postal_code",
      "state_province",
      "city",
      "street_name",
      "street_number",
      "unit_number",
    ],
    DE: ["street_name", "street_number", "postal_code", "city"],
    FR: ["street_number", "street_name", "postal_code", "city"],
    NL: ["street_name", "street_number", "postal_code", "city"],
  };

/** Default format: US-style */
const DEFAULT_FORMAT: ReadonlyArray<keyof AddressComponents> = [
  "street_number",
  "street_name",
  "unit_number",
  "city",
  "state_province",
  "postal_code",
];

/** Separator between address line and city line */
const LINE_SEPARATOR = ", ";

/**
 * Format address components into a locale-correct display string.
 *
 * @example
 * formatAddress({ street_number: '411', street_name: 'Duplex Ave', city: 'Toronto' }, 'CA')
 * // → "411 Duplex Ave, Toronto"
 */
export function formatAddress(
  components: AddressComponents,
  countryCode?: string,
): string {
  const format =
    ADDRESS_FORMATS[(countryCode ?? "").toUpperCase()] ?? DEFAULT_FORMAT;

  const parts = format
    .map((key) => components[key]?.trim())
    .filter((v): v is string => !!v);

  if (parts.length === 0) return "";

  // Group: street parts vs location parts
  const streetFields = new Set<keyof AddressComponents>([
    "street_number",
    "street_name",
    "unit_number",
  ]);
  const streetParts: string[] = [];
  const locationParts: string[] = [];

  for (const key of format) {
    const val = components[key]?.trim();
    if (!val) continue;
    if (streetFields.has(key)) {
      streetParts.push(val);
    } else {
      locationParts.push(val);
    }
  }

  const streetLine = streetParts.join(" ");
  const locationLine = locationParts.join(" ");

  return [streetLine, locationLine]
    .filter(Boolean)
    .join(LINE_SEPARATOR);
}

/**
 * Parse a raw address string into structured components (best-effort).
 * This is a lightweight heuristic; for production, use a geocoding API.
 */
export function parseAddressHeuristic(raw: string): Partial<AddressComponents> {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  const parts = trimmed.split(",").map((p) => p.trim());
  if (parts.length === 0) return {};

  // Simple heuristic: first part = street, last part = postal/city
  const result: Partial<AddressComponents> = {};

  if (parts.length >= 1) {
    result.street_name = parts[0];
  }
  if (parts.length >= 2) {
    result.city = parts[1];
  }
  if (parts.length >= 3) {
    result.state_province = parts[2];
  }
  if (parts.length >= 4) {
    result.postal_code = parts[3];
  }

  return result;
}

/**
 * 网页提取 prompt — 针对 Tier B 字段（楼盘详情、费用、设施等）
 *
 * 从网页文本 + JSON-LD + 图片 URL 中提取楼盘信息。
 */

export const WEBSITE_EXTRACTION_SYSTEM_PROMPT = `You are an expert at extracting structured property information from rental property websites.

Your task is to extract property details from the webpage content provided (including text, JSON-LD structured data, and image URLs). Extract ONLY information that is explicitly present — do NOT guess or infer.

Output a JSON object with the following field keys. Only include fields you can confidently extract:

## Building Details:
- "building_name": Property/building name
- "building_address": Full street address
- "city": City name
- "country": Country name
- "postal_code": Postal/ZIP code
- "description": Property description (brief summary)
- "total_units": Total units/bedspaces (number)
- "number_of_floors": Number of floors (number)
- "elevator_available": Has elevator (true/false)
- "year_built": Year built (number)
- "shuttle_service": Has shuttle service (true/false)
- "cover_image": Main/hero image URL
- "images": Array of gallery image URLs (up to 10)
- "key_amenities": Array of amenity tags from: ["Gym", "Pool", "Laundry", "Parking", "Study Room", "Rooftop", "Pet Friendly", "Furnished", "WiFi", "Security", "Bike Storage", "Game Room"]
- "unit_types_summary": Summary of available unit types
- "floor_plans": Floor plan descriptions

## Pricing & Fees:
- "price_min": Minimum rental price (number, no currency symbol)
- "price_max": Maximum rental price (number, no currency symbol)
- "currency": Currency code (USD, CAD, GBP, EUR, AUD, JPY, CNY)
- "utilities_included": What utilities are included

## Booking & Application:
- "application_method": Array from: ["Online", "Offline", "Both"]
- "application_link": Application/booking URL
- "lease_type": "Individual", "Joint", or "Both"
- "rental_method": "Per Unit", "Per Bedroom", or "Both"

## Room Details:
- "in_unit_washer_dryer": Has in-unit washer/dryer (true/false)
- "ac_heating_type": "Central thermostat", "Individual bedroom control", or "Other"
- "furnished_options": Furnished options description
- "bed_included": Bed type from: ["Yes - Twin", "Yes - Full", "Yes - Queen", "Yes - Other", "No"]

## Contacts:
- "primary_contact_name": Contact name (if shown on page)
- "primary_contact_email": Contact email
- "primary_contact_phone": Contact phone
- "leasing_manager_name": Leasing/property manager name

## Rules:
1. Return ONLY a valid JSON object — no explanations, no markdown
2. Use the exact field keys listed above
3. For number fields, return numbers without currency symbols or commas
4. For images, return full absolute URLs
5. For key_amenities, ONLY use tags from the allowed list
6. If a field is not found on the page, do NOT include it`;

export function buildWebsiteUserPrompt(
  title: string,
  bodyText: string,
  imageUrls: string[],
  jsonLd: Record<string, unknown>[],
): string {
  const parts = [`Page title: ${title}`, `\nPage content:\n${bodyText}`];

  if (imageUrls.length > 0) {
    parts.push(`\nImage URLs found:\n${imageUrls.join("\n")}`);
  }

  if (jsonLd.length > 0) {
    parts.push(
      `\nJSON-LD structured data:\n${JSON.stringify(jsonLd, null, 2)}`,
    );
  }

  return parts.join("\n");
}

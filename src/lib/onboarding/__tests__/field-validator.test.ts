import { describe, it, expect } from "vitest";
import { validateFields } from "../field-validator";

describe("validateFields", () => {
  // ── unknown key ──
  it("rejects unknown field keys", () => {
    const result = validateFields({ not_a_real_field: "hello" });
    expect(result.ok).toBe(false);
    expect(result.errors[0].key).toBe("not_a_real_field");
  });

  // ── null clears a field ──
  it("accepts null for any field type", () => {
    const result = validateFields({
      building_name: null,
      price_min: null,
      elevator_available: null,
      currency: null,
      availability_method: null,
    });
    expect(result.ok).toBe(true);
  });

  // ── text ──
  it("accepts string for text field", () => {
    expect(validateFields({ building_name: "Test Tower" }).ok).toBe(true);
  });

  it("rejects non-string for text field", () => {
    const result = validateFields({ building_name: 42 });
    expect(result.ok).toBe(false);
    expect(result.errors[0].key).toBe("building_name");
  });

  // ── number ──
  it("accepts finite non-negative number", () => {
    expect(validateFields({ price_min: 500 }).ok).toBe(true);
    expect(validateFields({ price_min: 0 }).ok).toBe(true);
  });

  it("rejects string for number field", () => {
    expect(validateFields({ price_min: "500" }).ok).toBe(false);
  });

  it("rejects negative number", () => {
    expect(validateFields({ price_min: -1 }).ok).toBe(false);
  });

  it("rejects NaN and Infinity", () => {
    expect(validateFields({ price_min: NaN }).ok).toBe(false);
    expect(validateFields({ price_min: Infinity }).ok).toBe(false);
  });

  // ── boolean ──
  it("accepts boolean values", () => {
    expect(validateFields({ elevator_available: true }).ok).toBe(true);
    expect(validateFields({ elevator_available: false }).ok).toBe(true);
  });

  it("rejects string for boolean field", () => {
    expect(validateFields({ elevator_available: "yes" }).ok).toBe(false);
  });

  // ── select ──
  it("accepts valid option for select field", () => {
    expect(validateFields({ currency: "USD" }).ok).toBe(true);
  });

  it("rejects invalid option for select field", () => {
    const result = validateFields({ currency: "BTC" });
    expect(result.ok).toBe(false);
    expect(result.errors[0].message).toMatch(/Must be one of/);
  });

  // ── rent_period select ──
  it("accepts valid rent_period option", () => {
    expect(validateFields({ rent_period: "Weekly" }).ok).toBe(true);
    expect(validateFields({ rent_period: "Monthly" }).ok).toBe(true);
    expect(validateFields({ rent_period: "Yearly" }).ok).toBe(true);
  });

  it("rejects invalid rent_period option", () => {
    const result = validateFields({ rent_period: "Daily" });
    expect(result.ok).toBe(false);
    expect(result.errors[0].message).toMatch(/Must be one of/);
  });

  // ── multi_select ──
  it("accepts valid options array for multi_select", () => {
    expect(
      validateFields({
        availability_method: ["Google Sheet", "API Integration"],
      }).ok,
    ).toBe(true);
  });

  it("accepts empty array for multi_select", () => {
    expect(validateFields({ availability_method: [] }).ok).toBe(true);
  });

  it("rejects non-array for multi_select", () => {
    expect(validateFields({ availability_method: "Google Sheet" }).ok).toBe(
      false,
    );
  });

  it("rejects out-of-range option in multi_select", () => {
    const result = validateFields({
      availability_method: ["Google Sheet", "Carrier Pigeon"],
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0].message).toMatch(/Invalid options/);
  });

  // ── multi_select maxItems ──
  it("accepts multi_select within maxItems limit", () => {
    expect(
      validateFields({
        key_amenities: [
          "Gym",
          "Pool",
          "Laundry",
          "Parking",
          "WiFi",
          "Security",
        ],
      }).ok,
    ).toBe(true);
  });

  it("rejects multi_select exceeding maxItems limit", () => {
    const result = validateFields({
      key_amenities: [
        "Gym",
        "Pool",
        "Laundry",
        "Parking",
        "WiFi",
        "Security",
        "Rooftop",
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0].message).toMatch(/Too many items: maximum is 6/);
  });

  // ── email ──
  it("accepts valid email", () => {
    expect(
      validateFields({ primary_contact_email: "test@example.com" }).ok,
    ).toBe(true);
  });

  it("rejects invalid email", () => {
    expect(validateFields({ primary_contact_email: "not-an-email" }).ok).toBe(
      false,
    );
  });

  // ── url ──
  it("accepts valid URL", () => {
    expect(
      validateFields({ cover_image: "https://example.com/photo.jpg" }).ok,
    ).toBe(true);
    expect(
      validateFields({ cover_image: "http://example.com/photo.jpg" }).ok,
    ).toBe(true);
  });

  it("rejects URL without http/https scheme", () => {
    expect(validateFields({ cover_image: "ftp://example.com" }).ok).toBe(false);
    expect(validateFields({ cover_image: "example.com/photo.jpg" }).ok).toBe(
      false,
    );
  });

  // ── image_urls ──
  it("accepts array of valid URLs for image_urls", () => {
    expect(
      validateFields({ images: ["https://a.com/1.jpg", "https://b.com/2.jpg"] })
        .ok,
    ).toBe(true);
  });

  it("rejects image_urls containing invalid URL", () => {
    const result = validateFields({
      images: ["https://ok.com/1.jpg", "not-a-url"],
    });
    expect(result.ok).toBe(false);
  });

  // ── multiple errors in one call ──
  it("returns all errors when multiple fields are invalid", () => {
    const result = validateFields({
      building_name: 123,
      price_min: "expensive",
      currency: "DOGE",
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(3);
  });

  // ── cross-field: price_min vs price_max ──
  it("rejects price_min greater than price_max", () => {
    const result = validateFields({ price_min: 2000, price_max: 800 });
    expect(result.ok).toBe(false);
    expect(result.errors[0].key).toBe("price_min");
    expect(result.errors[0].message).toMatch(/cannot be greater/i);
  });

  it("accepts price_min equal to price_max", () => {
    expect(validateFields({ price_min: 500, price_max: 500 }).ok).toBe(true);
  });

  it("accepts price_min less than price_max", () => {
    expect(validateFields({ price_min: 500, price_max: 2000 }).ok).toBe(true);
  });
});

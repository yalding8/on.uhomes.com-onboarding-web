/**
 * structured-data-mapper.ts 单元测试
 */

import { describe, it, expect } from "vitest";
import { mapStructuredData } from "./structured-data-mapper.js";

describe("mapStructuredData", () => {
  it("should map basic apartment JSON-LD fields", () => {
    const jsonLd = [
      {
        "@type": "ApartmentComplex",
        name: "Skyline Towers",
        description: "Modern luxury apartments",
        telephone: "+1-555-123-4567",
        address: {
          streetAddress: "123 Main St",
          addressLocality: "Austin",
          addressCountry: "US",
          postalCode: "78701",
        },
      },
    ];

    const result = mapStructuredData(jsonLd);

    expect(result.fields.building_name?.value).toBe("Skyline Towers");
    expect(result.fields.building_name?.confidence).toBe("high");
    expect(result.fields.city?.value).toBe("Austin");
    expect(result.fields.country?.value).toBe("US");
    expect(result.fields.postal_code?.value).toBe("78701");
    expect(result.fields.primary_contact_phone?.value).toBe("+1-555-123-4567");
    expect(result.coveredCount).toBeGreaterThan(0);
  });

  it("should map price offers", () => {
    const jsonLd = [
      {
        "@type": "ApartmentComplex",
        name: "Test",
        offers: {
          lowPrice: "1200",
          highPrice: "3500",
          priceCurrency: "USD",
        },
      },
    ];

    const result = mapStructuredData(jsonLd);

    expect(result.fields.price_min?.value).toBe(1200);
    expect(result.fields.price_max?.value).toBe(3500);
    expect(result.fields.currency?.value).toBe("USD");
  });

  it("should handle image arrays", () => {
    const jsonLd = [
      {
        "@type": "ApartmentComplex",
        name: "Test",
        image: ["https://example.com/img1.jpg", "https://example.com/img2.jpg"],
      },
    ];

    const result = mapStructuredData(jsonLd);

    expect(result.fields.cover_image?.value).toBe(
      "https://example.com/img1.jpg",
    );
    expect(result.fields.images?.value).toEqual([
      "https://example.com/img1.jpg",
      "https://example.com/img2.jpg",
    ]);
  });

  it("should handle amenity features", () => {
    const jsonLd = [
      {
        "@type": "ApartmentComplex",
        name: "Test",
        amenityFeature: [
          { name: "Swimming Pool" },
          { name: "Fitness Center" },
          { name: "Parking" },
        ],
      },
    ];

    const result = mapStructuredData(jsonLd);

    expect(result.fields.key_amenities?.value).toEqual([
      "Swimming Pool",
      "Fitness Center",
      "Parking",
    ]);
  });

  it("should skip non-property JSON-LD types", () => {
    const jsonLd = [
      { "@type": "BreadcrumbList", name: "Home > Apartments" },
      {
        "@type": "ApartmentComplex",
        name: "Real Apartment",
        address: { addressLocality: "Chicago" },
      },
    ];

    const result = mapStructuredData(jsonLd);

    expect(result.fields.building_name?.value).toBe("Real Apartment");
    expect(result.fields.city?.value).toBe("Chicago");
  });

  it("should return coverage ratio", () => {
    const jsonLd = [
      {
        "@type": "ApartmentComplex",
        name: "Test",
        address: {
          streetAddress: "123 St",
          addressLocality: "City",
          addressCountry: "US",
          postalCode: "12345",
        },
      },
    ];

    const result = mapStructuredData(jsonLd);

    expect(result.coverageRatio).toBeGreaterThan(0);
    expect(result.coverageRatio).toBeLessThanOrEqual(1);
    expect(result.totalTargetFields).toBeGreaterThan(0);
  });

  it("should return empty fields for empty input", () => {
    const result = mapStructuredData([]);
    expect(result.fields).toEqual({});
    expect(result.coveredCount).toBe(0);
  });
});

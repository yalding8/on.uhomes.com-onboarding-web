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

  // ── 新增规则测试 ──

  it("should map location.address nested path", () => {
    const jsonLd = [
      {
        "@type": "Hotel",
        name: "Grand Hotel",
        location: {
          address: {
            streetAddress: "456 Oak Ave",
            addressLocality: "London",
            addressCountry: "UK",
            postalCode: "SW1A 1AA",
          },
        },
      },
    ];
    const result = mapStructuredData(jsonLd);
    expect(result.fields.building_address?.value).toBe("456 Oak Ave");
    expect(result.fields.city?.value).toBe("London");
    expect(result.fields.country?.value).toBe("UK");
    expect(result.fields.postal_code?.value).toBe("SW1A 1AA");
  });

  it("should map yearBuilt", () => {
    const jsonLd = [{ "@type": "Apartment", name: "Test", yearBuilt: 2020 }];
    const result = mapStructuredData(jsonLd);
    expect(result.fields.year_built?.value).toBe(2020);
  });

  it("should map petsAllowed to amenity", () => {
    const jsonLd = [{ "@type": "Apartment", name: "Test", petsAllowed: true }];
    const result = mapStructuredData(jsonLd);
    expect(result.fields.key_amenities?.value).toContain("Pet Friendly");
  });

  it("should handle WebSite @type with property data", () => {
    const jsonLd = [
      {
        "@type": "WebSite",
        name: "Maple Residences",
        telephone: "+44-20-1234",
      },
    ];
    const result = mapStructuredData(jsonLd);
    expect(result.fields.building_name?.value).toBe("Maple Residences");
    expect(result.fields.primary_contact_phone?.value).toBe("+44-20-1234");
  });

  it("should handle array @type", () => {
    const jsonLd = [
      {
        "@type": ["LocalBusiness", "LodgingBusiness"],
        name: "City Suites",
        email: "info@city.com",
      },
    ];
    const result = mapStructuredData(jsonLd);
    expect(result.fields.building_name?.value).toBe("City Suites");
  });

  it("should map offers.price single value", () => {
    const jsonLd = [
      {
        "@type": "Apartment",
        name: "Test",
        offers: { price: "1500", priceCurrency: "GBP" },
      },
    ];
    const result = mapStructuredData(jsonLd);
    expect(result.fields.price_min?.value).toBe(1500);
    expect(result.fields.currency?.value).toBe("GBP");
  });

  it("should map photos array to images", () => {
    const jsonLd = [
      {
        "@type": "Apartment",
        name: "Test",
        photos: [
          { url: "https://example.com/a.jpg" },
          { url: "https://example.com/b.jpg" },
        ],
      },
    ];
    const result = mapStructuredData(jsonLd);
    const images = result.fields.images?.value as string[];
    expect(images).toContain("https://example.com/a.jpg");
    expect(images).toContain("https://example.com/b.jpg");
  });

  // ── OPT-1: @graph 展开测试 ──

  it("should unwrap @graph wrapper (WordPress Yoast)", () => {
    const jsonLd = [
      {
        "@graph": [
          {
            "@type": "ApartmentComplex",
            name: "Graph Apartments",
            address: {
              streetAddress: "789 Elm St",
              addressLocality: "Denver",
              addressCountry: "US",
            },
          },
          { "@type": "BreadcrumbList", name: "Home" },
        ],
      },
    ];
    const result = mapStructuredData(jsonLd);
    expect(result.fields.building_name?.value).toBe("Graph Apartments");
    expect(result.fields.city?.value).toBe("Denver");
    expect(result.fields.country?.value).toBe("US");
  });

  it("should handle mixed @graph and standalone items", () => {
    const jsonLd = [
      { "@type": "WebSite", name: "Site Title" },
      {
        "@graph": [
          {
            "@type": "Apartment",
            name: "Real Name",
            telephone: "+1-555-0000",
          },
        ],
      },
    ];
    const result = mapStructuredData(jsonLd);
    expect(result.fields.primary_contact_phone?.value).toBe("+1-555-0000");
  });

  it("should handle @graph with offers and prices", () => {
    const jsonLd = [
      {
        "@graph": [
          {
            "@type": "ApartmentComplex",
            name: "Price Graph",
            offers: {
              lowPrice: "2000",
              highPrice: "5000",
              priceCurrency: "CAD",
            },
          },
        ],
      },
    ];
    const result = mapStructuredData(jsonLd);
    expect(result.fields.price_min?.value).toBe(2000);
    expect(result.fields.price_max?.value).toBe(5000);
    expect(result.fields.currency?.value).toBe("CAD");
  });

  // ── OPT-F: @id 引用解析测试 ──

  it("should resolve @id references for image", () => {
    const jsonLd = [
      {
        "@graph": [
          {
            "@id": "https://example.com/#primaryimage",
            "@type": "ImageObject",
            url: "https://example.com/hero.jpg",
          },
          {
            "@type": "ApartmentComplex",
            name: "ID Ref Apartments",
            image: { "@id": "https://example.com/#primaryimage" },
          },
        ],
      },
    ];
    const result = mapStructuredData(jsonLd);
    expect(result.fields.building_name?.value).toBe("ID Ref Apartments");
    // image resolves through @id to ImageObject, then image.url maps
    expect(result.fields.cover_image).toBeDefined();
  });

  it("should resolve nested @id references for address", () => {
    const jsonLd = [
      {
        "@graph": [
          {
            "@id": "https://example.com/#address",
            "@type": "PostalAddress",
            streetAddress: "100 Park Ave",
            addressLocality: "Boston",
            addressCountry: "US",
          },
          {
            "@type": "ApartmentComplex",
            name: "Ref Address",
            address: { "@id": "https://example.com/#address" },
          },
        ],
      },
    ];
    const result = mapStructuredData(jsonLd);
    expect(result.fields.building_address?.value).toBe("100 Park Ave");
    expect(result.fields.city?.value).toBe("Boston");
  });

  it("should not crash on unresolvable @id reference", () => {
    const jsonLd = [
      {
        "@type": "ApartmentComplex",
        name: "Missing Ref",
        image: { "@id": "https://example.com/#nonexistent" },
      },
    ];
    const result = mapStructuredData(jsonLd);
    expect(result.fields.building_name?.value).toBe("Missing Ref");
    // image with unresolvable @id should not crash, just skip
  });

  it("should not resolve numberOfRooms to total_units (OPT-D)", () => {
    const jsonLd = [
      {
        "@type": "Apartment",
        name: "Test",
        numberOfBedrooms: 3,
      },
    ];
    const result = mapStructuredData(jsonLd);
    expect(result.fields.total_units).toBeUndefined();
  });
});

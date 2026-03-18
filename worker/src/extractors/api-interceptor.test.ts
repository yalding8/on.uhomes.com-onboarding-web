import { describe, it, expect } from "vitest";
import { isApartmentData, mapApiResponse } from "./api-interceptor.js";

describe("isApartmentData", () => {
  it("should detect apartment pricing data", () => {
    const json = { units: [{ price: 1500, bedrooms: 1, name: "Studio" }] };
    expect(isApartmentData(JSON.stringify(json))).toBe(true);
  });

  it("should detect amenities data", () => {
    const json = {
      amenities: ["Gym", "Pool", "Parking"],
      buildingName: "Test Tower",
    };
    expect(isApartmentData(JSON.stringify(json))).toBe(true);
  });

  it("should reject analytics/config JSON", () => {
    const json = { gtm_id: "GTM-123", event: "page_view", userId: "abc" };
    expect(isApartmentData(JSON.stringify(json))).toBe(false);
  });

  it("should reject auth/session JSON", () => {
    const json = {
      access_token: "jwt...",
      refresh_token: "...",
      expires_in: 3600,
    };
    expect(isApartmentData(JSON.stringify(json))).toBe(false);
  });

  it("should reject small JSON payloads", () => {
    expect(isApartmentData('{"ok":true}')).toBe(false);
  });
});

describe("mapApiResponse", () => {
  it("should map flat apartment data", () => {
    const json = {
      name: "Test Tower",
      address: "123 Main St",
      city: "New York",
      minRent: 1500,
      maxRent: 3500,
      amenities: ["Gym", "Pool", "Laundry"],
    };
    const fields = mapApiResponse(json);
    expect(fields.building_name?.value).toBe("Test Tower");
    expect(fields.price_min?.value).toBe(1500);
    expect(fields.key_amenities?.value).toContain("Gym");
    expect(fields.building_name?.confidence).toBe("high");
  });

  it("should map nested unit/floorplan data", () => {
    const json = {
      property: {
        name: "Nested Tower",
        units: [
          { type: "Studio", rent: 1200 },
          { type: "1BR", rent: 1800 },
        ],
      },
    };
    const fields = mapApiResponse(json);
    expect(fields.building_name?.value).toBe("Nested Tower");
    expect(fields.unit_types_summary).toBeDefined();
  });

  it("should map GraphQL response with data wrapper", () => {
    const json = {
      data: {
        property: {
          name: "GraphQL Tower",
          address: "456 Oak Ave",
          amenities: [{ name: "Gym" }, { name: "Pool" }],
        },
      },
    };
    const fields = mapApiResponse(json);
    expect(fields.building_name?.value).toBe("GraphQL Tower");
  });

  it("should return empty for non-apartment data", () => {
    const json = { config: { theme: "dark" }, version: "1.0" };
    const fields = mapApiResponse(json);
    expect(Object.keys(fields).length).toBe(0);
  });

  it("should assign high confidence to all API fields", () => {
    const json = { name: "Test", city: "NYC", rent: 2000 };
    const fields = mapApiResponse(json);
    for (const field of Object.values(fields)) {
      expect(field.confidence).toBe("high");
    }
  });
});

import { describe, it, expect } from "vitest";
import { mapOpenGraphData } from "./og-mapper.js";

describe("mapOpenGraphData", () => {
  it("should map basic OG fields", () => {
    const og = {
      title: "Sunset Apartments",
      description: "Luxury living downtown",
      image: "https://example.com/hero.jpg",
    };
    const fields = mapOpenGraphData(og);
    expect(fields.building_name?.value).toBe("Sunset Apartments");
    expect(fields.description?.value).toBe("Luxury living downtown");
    expect(fields.cover_image?.value).toBe("https://example.com/hero.jpg");
  });

  it("should create images array from og:image", () => {
    const og = { image: "https://example.com/hero.jpg" };
    const fields = mapOpenGraphData(og);
    expect(fields.images?.value).toEqual(["https://example.com/hero.jpg"]);
    expect(fields.images?.confidence).toBe("low");
  });

  it("should map address fields", () => {
    const og = {
      "street-address": "123 Main St",
      locality: "Austin",
      "country-name": "United States",
      "postal-code": "78701",
    };
    const fields = mapOpenGraphData(og);
    expect(fields.building_address?.value).toBe("123 Main St");
    expect(fields.city?.value).toBe("Austin");
    expect(fields.country?.value).toBe("United States");
    expect(fields.postal_code?.value).toBe("78701");
  });

  it("should map underscore address variants", () => {
    const og = {
      street_address: "456 Oak Ave",
      country_name: "Canada",
      postal_code: "M5V 1A1",
    };
    const fields = mapOpenGraphData(og);
    expect(fields.building_address?.value).toBe("456 Oak Ave");
    expect(fields.country?.value).toBe("Canada");
    expect(fields.postal_code?.value).toBe("M5V 1A1");
  });

  it("should map contact fields", () => {
    const og = {
      phone_number: "+1-555-1234",
      email: "info@apartments.com",
    };
    const fields = mapOpenGraphData(og);
    expect(fields.primary_contact_phone?.value).toBe("+1-555-1234");
    expect(fields.primary_contact_email?.value).toBe("info@apartments.com");
  });

  it("should return empty for empty input", () => {
    const fields = mapOpenGraphData({});
    expect(Object.keys(fields)).toHaveLength(0);
  });

  it("should set medium confidence for all fields", () => {
    const og = { title: "Test", locality: "City" };
    const fields = mapOpenGraphData(og);
    expect(fields.building_name?.confidence).toBe("medium");
    expect(fields.city?.confidence).toBe("medium");
  });
});

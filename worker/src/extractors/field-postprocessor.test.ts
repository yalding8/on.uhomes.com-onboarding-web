import { describe, it, expect } from "vitest";
import { postprocessFields } from "./field-postprocessor.js";
import type { ExtractedFields } from "../types.js";

describe("postprocessFields", () => {
  it("should clean building_name with pipe separator", () => {
    const fields: ExtractedFields = {
      building_name: {
        value: "Sable | Apartments in JC | Veris",
        confidence: "high",
      },
    };
    postprocessFields(fields, "https://example.com");
    expect(fields.building_name?.value).toBe("Sable");
  });

  it("should clean building_name with dash separator", () => {
    const fields: ExtractedFields = {
      building_name: {
        value: "The Beacon - Luxury Apartments - Jersey City",
        confidence: "high",
      },
    };
    postprocessFields(fields, "https://example.com");
    expect(fields.building_name?.value).toBe("The Beacon");
  });

  it("should not clean short building_name segments", () => {
    const fields: ExtractedFields = {
      building_name: { value: "A | Building Name", confidence: "high" },
    };
    postprocessFields(fields, "https://example.com");
    // "A" is too short (< 3 chars), keep original
    expect(fields.building_name?.value).toBe("A | Building Name");
  });

  it("should resolve relative image URLs", () => {
    const fields: ExtractedFields = {
      cover_image: { value: "/images/hero.jpg", confidence: "high" },
      images: {
        value: ["/img/a.jpg", "https://cdn.com/b.jpg"],
        confidence: "medium",
      },
    };
    postprocessFields(fields, "https://example.com/page");
    expect(fields.cover_image?.value).toBe(
      "https://example.com/images/hero.jpg",
    );
    expect((fields.images?.value as string[])[0]).toBe(
      "https://example.com/img/a.jpg",
    );
    expect((fields.images?.value as string[])[1]).toBe("https://cdn.com/b.jpg");
  });

  it("should strip HTML from description", () => {
    const fields: ExtractedFields = {
      description: {
        value: "<p>Modern <b>luxury</b> apartments.<br/>Call today!</p>",
        confidence: "high",
      },
    };
    postprocessFields(fields, "https://example.com");
    expect(fields.description?.value).toBe(
      "Modern luxury apartments.\nCall today!",
    );
  });

  it("should clean address with phone number", () => {
    const fields: ExtractedFields = {
      building_address: {
        value: "123 Main St, City (555) 123-4567",
        confidence: "high",
      },
    };
    postprocessFields(fields, "https://example.com");
    expect(fields.building_address?.value).toBe("123 Main St, City");
  });

  it("should clean address with email", () => {
    const fields: ExtractedFields = {
      building_address: {
        value: "123 Main St, City info@example.com",
        confidence: "high",
      },
    };
    postprocessFields(fields, "https://example.com");
    expect(fields.building_address?.value).toBe("123 Main St, City");
  });

  it("should handle fields with no issues", () => {
    const fields: ExtractedFields = {
      building_name: { value: "Simple Name", confidence: "high" },
      cover_image: {
        value: "https://example.com/img.jpg",
        confidence: "high",
      },
    };
    postprocessFields(fields, "https://example.com");
    expect(fields.building_name?.value).toBe("Simple Name");
    expect(fields.cover_image?.value).toBe("https://example.com/img.jpg");
  });
});

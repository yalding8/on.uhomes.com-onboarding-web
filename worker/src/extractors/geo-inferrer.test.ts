import { describe, it, expect } from "vitest";
import { inferGeoFields } from "./geo-inferrer.js";

describe("inferGeoFields", () => {
  it("should infer country from .co.uk TLD", () => {
    const result = inferGeoFields({}, "https://www.example.co.uk/apartments");
    expect(result.country?.value).toBe("United Kingdom");
    expect(result.country?.confidence).toBe("medium");
  });

  it("should infer country from .com.au TLD", () => {
    const result = inferGeoFields({}, "https://rentals.example.com.au");
    expect(result.country?.value).toBe("Australia");
  });

  it("should infer country from .ca TLD", () => {
    const result = inferGeoFields({}, "https://housing4u.ca");
    expect(result.country?.value).toBe("Canada");
  });

  it("should not infer country from .com TLD", () => {
    const result = inferGeoFields({}, "https://example.com");
    expect(result.country).toBeUndefined();
  });

  it("should infer US from known US city", () => {
    const fields = {
      city: { value: "Jersey City", confidence: "high" as const },
    };
    const result = inferGeoFields(fields, "https://example.com");
    expect(result.country?.value).toBe("United States");
  });

  it("should infer currency from country", () => {
    const fields = {
      country: { value: "United Kingdom", confidence: "high" as const },
    };
    const result = inferGeoFields(fields, "https://example.co.uk");
    expect(result.currency?.value).toBe("GBP");
  });

  it("should infer both country and currency from TLD", () => {
    const result = inferGeoFields({}, "https://example.de");
    expect(result.country?.value).toBe("Germany");
    expect(result.currency?.value).toBe("EUR");
  });

  it("should not override existing country", () => {
    const fields = {
      country: { value: "France", confidence: "high" as const },
    };
    const result = inferGeoFields(fields, "https://example.co.uk");
    expect(result.country).toBeUndefined();
  });

  it("should not override existing currency", () => {
    const fields = {
      country: { value: "United States", confidence: "high" as const },
      currency: { value: "EUR", confidence: "high" as const },
    };
    const result = inferGeoFields(fields, "https://example.com");
    expect(result.currency).toBeUndefined();
  });

  it("should infer USD for US city on .com", () => {
    const fields = { city: { value: "Brooklyn", confidence: "high" as const } };
    const result = inferGeoFields(fields, "https://example.com");
    expect(result.country?.value).toBe("United States");
    expect(result.currency?.value).toBe("USD");
  });
});

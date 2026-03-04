/**
 * S2.2 Amenity Taxonomy — Unit Tests
 * Test IDs: S2-U03, S2-U04, S2-U05, S2-U06
 */
import { describe, it, expect } from "vitest";
import { normalizeAmenity, AMENITY_CATALOG } from "../amenity-taxonomy";

describe("normalizeAmenity", () => {
  // S2-U03: Exact canonical match
  it("matches exact canonical name 'Gym'", () => {
    const result = normalizeAmenity("Gym");
    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.amenity.canonicalName).toBe("Gym");
      expect(result.method).toBe("exact");
    }
  });

  it("matches exact canonical name case-insensitively", () => {
    const result = normalizeAmenity("gym");
    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.amenity.canonicalName).toBe("Gym");
    }
  });

  // S2-U04: Alias match
  it("matches alias 'Fitness Center' to 'Gym'", () => {
    const result = normalizeAmenity("Fitness Center");
    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.amenity.canonicalName).toBe("Gym");
      expect(result.method).toBe("alias");
    }
  });

  it("matches alias 'Fitness Centre' to 'Gym'", () => {
    const result = normalizeAmenity("Fitness Centre");
    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.amenity.canonicalName).toBe("Gym");
    }
  });

  it("matches alias 'indoor pool' to 'Swimming Pool'", () => {
    const result = normalizeAmenity("indoor pool");
    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.amenity.canonicalName).toBe("Swimming Pool");
    }
  });

  it("matches alias 'wi-fi' to 'High-Speed WiFi'", () => {
    const result = normalizeAmenity("wi-fi");
    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.amenity.canonicalName).toBe("High-Speed WiFi");
    }
  });

  // S2-U05: Fuzzy match (Levenshtein ≤ 2)
  it("fuzzy matches 'Fitnes Centre' (typo) to 'Gym'", () => {
    const result = normalizeAmenity("Fitnes Centre");
    // "Fitnes Centre" vs alias "Fitness Centre" → distance = 1
    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.amenity.canonicalName).toBe("Gym");
      expect(result.method).toBe("fuzzy");
    }
  });

  it("fuzzy matches 'Elevtor' (typo) to 'Elevator'", () => {
    const result = normalizeAmenity("Elevtor");
    // "elevtor" vs "elevator" → distance = 1
    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.amenity.canonicalName).toBe("Elevator");
      expect(result.method).toBe("fuzzy");
    }
  });

  // S2-U06: No match
  it("returns unmatched for 'Underwater Restaurant'", () => {
    const result = normalizeAmenity("Underwater Restaurant");
    expect(result.matched).toBe(false);
    if (!result.matched) {
      expect(result.raw).toBe("Underwater Restaurant");
    }
  });

  it("returns unmatched for empty string", () => {
    const result = normalizeAmenity("");
    expect(result.matched).toBe(false);
  });

  it("returns unmatched for completely unrelated input", () => {
    const result = normalizeAmenity("Quantum Teleportation Chamber");
    expect(result.matched).toBe(false);
  });
});

describe("AMENITY_CATALOG", () => {
  it("has unique IDs", () => {
    const ids = AMENITY_CATALOG.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has unique canonical names", () => {
    const names = AMENITY_CATALOG.map((a) => a.canonicalName);
    expect(new Set(names).size).toBe(names.length);
  });

  it("covers all 10 categories", () => {
    const categories = new Set(AMENITY_CATALOG.map((a) => a.category));
    expect(categories.size).toBe(10);
  });
});

import { describe, it, expect } from "vitest";
import {
  parseCoveredProperties,
  fuzzyMatchBuilding,
  CONTRACT_TO_BUILDING_MAP,
} from "../contract-field-mapping";

describe("CONTRACT_TO_BUILDING_MAP", () => {
  it("maps contract fields to building fields", () => {
    expect(CONTRACT_TO_BUILDING_MAP.partner_contact_name).toBe(
      "primary_contact_name",
    );
    expect(CONTRACT_TO_BUILDING_MAP.commission_rate).toBe(
      "commission_structure",
    );
  });
});

describe("parseCoveredProperties", () => {
  it("splits by comma", () => {
    expect(parseCoveredProperties("Building A, Building B")).toEqual([
      "Building A",
      "Building B",
    ]);
  });

  it("splits by semicolon", () => {
    expect(parseCoveredProperties("A; B; C")).toEqual(["A", "B", "C"]);
  });

  it("splits by newline", () => {
    expect(parseCoveredProperties("A\nB\nC")).toEqual(["A", "B", "C"]);
  });

  it("returns empty array for null", () => {
    expect(parseCoveredProperties(null)).toEqual([]);
  });

  it("filters empty strings", () => {
    expect(parseCoveredProperties("A,,B, ,C")).toEqual(["A", "B", "C"]);
  });
});

describe("fuzzyMatchBuilding", () => {
  const buildings = [
    { id: "1", building_name: "Sunset Apartments" },
    { id: "2", building_name: "Ocean View Tower" },
    { id: "3", building_name: "The Grand" },
  ];

  it("exact match", () => {
    expect(fuzzyMatchBuilding("Sunset Apartments", buildings)).toBe("1");
  });

  it("case-insensitive exact match", () => {
    expect(fuzzyMatchBuilding("sunset apartments", buildings)).toBe("1");
  });

  it("contains match (property name in building name)", () => {
    expect(fuzzyMatchBuilding("Ocean View", buildings)).toBe("2");
  });

  it("returns null for short names (< 4 chars)", () => {
    expect(fuzzyMatchBuilding("The", buildings)).toBeNull();
  });

  it("returns null for no match", () => {
    expect(fuzzyMatchBuilding("Nonexistent Place", buildings)).toBeNull();
  });

  it("returns null for empty buildings list", () => {
    expect(fuzzyMatchBuilding("Sunset Apartments", [])).toBeNull();
  });
});

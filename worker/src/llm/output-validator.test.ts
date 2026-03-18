import { describe, it, expect } from "vitest";
import { validateAndRepairOutput } from "./output-validator.js";

describe("validateAndRepairOutput", () => {
  it("should accept valid JSON with correct field types", () => {
    const raw = JSON.stringify({
      building_name: "Test Tower",
      price_min: 1500,
      key_amenities: ["Gym", "Pool"],
    });
    const result = validateAndRepairOutput(raw);
    expect(result.building_name).toBe("Test Tower");
    expect(result.price_min).toBe(1500);
    expect(result.key_amenities).toEqual(["Gym", "Pool"]);
  });

  it("should coerce string numbers to numbers", () => {
    const raw = JSON.stringify({ price_min: "$1,500", total_units: "200" });
    const result = validateAndRepairOutput(raw);
    expect(result.price_min).toBe(1500);
    expect(result.total_units).toBe(200);
  });

  it("should coerce string booleans", () => {
    const raw = JSON.stringify({ elevator_available: "Yes", in_unit_washer_dryer: "false" });
    const result = validateAndRepairOutput(raw);
    expect(result.elevator_available).toBe(true);
    expect(result.in_unit_washer_dryer).toBe(false);
  });

  it("should coerce comma-separated amenities to array", () => {
    const raw = JSON.stringify({ key_amenities: "Gym, Pool, Laundry" });
    const result = validateAndRepairOutput(raw);
    expect(result.key_amenities).toEqual(["Gym", "Pool", "Laundry"]);
  });

  it("should strip unknown fields", () => {
    const raw = JSON.stringify({ building_name: "Test", unknown_field: "junk" });
    const result = validateAndRepairOutput(raw);
    expect(result.building_name).toBe("Test");
    expect((result as Record<string, unknown>).unknown_field).toBeUndefined();
  });

  it("should strip null and empty values", () => {
    const raw = JSON.stringify({ building_name: "Test", city: null, country: "" });
    const result = validateAndRepairOutput(raw);
    expect(result.building_name).toBe("Test");
    expect(result.city).toBeUndefined();
    expect(result.country).toBeUndefined();
  });

  it("should return empty object for completely invalid input", () => {
    const result = validateAndRepairOutput("not json at all");
    expect(Object.keys(result).length).toBe(0);
  });

  it("should handle truncated JSON by recovering partial fields", () => {
    const raw = '{"building_name":"Tower","city":"NYC","key_amenities":["Gym","Po';
    const result = validateAndRepairOutput(raw);
    expect(result.building_name).toBe("Tower");
    expect(result.city).toBe("NYC");
  });
});

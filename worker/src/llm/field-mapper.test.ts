/**
 * field-mapper.ts 单元测试
 */

import { describe, it, expect } from "vitest";
import { mapLlmOutput } from "./field-mapper.js";

describe("mapLlmOutput", () => {
  it("should parse clean JSON and map valid fields", () => {
    const raw = JSON.stringify({
      building_name: "Test Tower",
      city: "New York",
      price_min: 1200,
    });

    const result = mapLlmOutput(raw);

    expect(result.building_name).toEqual({
      value: "Test Tower",
      confidence: "high",
    });
    expect(result.city).toEqual({ value: "New York", confidence: "high" });
    expect(result.price_min).toEqual({ value: 1200, confidence: "low" });
  });

  it("should strip markdown code fences", () => {
    const raw = '```json\n{"building_name": "Fenced Tower"}\n```';
    const result = mapLlmOutput(raw);
    expect(result.building_name?.value).toBe("Fenced Tower");
  });

  it("should skip unknown field keys", () => {
    const raw = JSON.stringify({
      building_name: "Test",
      unknown_field: "should be skipped",
    });

    const result = mapLlmOutput(raw);
    expect(result.building_name).toBeDefined();
    expect(result.unknown_field).toBeUndefined();
  });

  it("should skip null and empty string values", () => {
    const raw = JSON.stringify({
      building_name: null,
      city: "",
      country: "  ",
    });

    const result = mapLlmOutput(raw);
    expect(result.building_name).toBeUndefined();
    expect(result.city).toBeUndefined();
    expect(result.country).toBeUndefined();
  });

  it("should coerce number strings to numbers", () => {
    const raw = JSON.stringify({
      price_min: "$1,200",
      price_max: "2500.50",
      total_units: "150",
    });

    const result = mapLlmOutput(raw);
    expect(result.price_min?.value).toBe(1200);
    expect(result.price_max?.value).toBe(2500.5);
    expect(result.total_units?.value).toBe(150);
  });

  it("should coerce boolean strings", () => {
    const raw = JSON.stringify({
      elevator_available: "Yes",
      shuttle_service: "false",
    });

    const result = mapLlmOutput(raw);
    expect(result.elevator_available?.value).toBe(true);
    expect(result.shuttle_service?.value).toBe(false);
  });

  it("should coerce comma-separated strings to arrays for multi_select", () => {
    const raw = JSON.stringify({
      key_amenities: "Gym, Pool, Laundry",
    });

    const result = mapLlmOutput(raw);
    expect(result.key_amenities?.value).toEqual(["Gym", "Pool", "Laundry"]);
  });

  it("should keep arrays as-is for multi_select", () => {
    const raw = JSON.stringify({
      key_amenities: ["Gym", "Pool"],
    });

    const result = mapLlmOutput(raw);
    expect(result.key_amenities?.value).toEqual(["Gym", "Pool"]);
  });

  it("should parse JSON with newlines inside keys/values (Kimi K2.5 pattern)", () => {
    // Kimi K2.5 实际输出：key 前面有换行字符
    const raw = '{\n"building_name":"Test Tower",\n"city":"New York"}';
    const result = mapLlmOutput(raw);
    expect(result.building_name?.value).toBe("Test Tower");
    expect(result.city?.value).toBe("New York");
  });

  it("should parse JSON with newlines embedded in keys (Kimi K2.5 variant)", () => {
    // 更极端的情况：换行在引号内部
    const raw = `{"\nbuilding_name":"\nTest Tower","\ncity":"New York"}`;
    const result = mapLlmOutput(raw);
    expect(result.building_name?.value).toBe("Test Tower");
    expect(result.city?.value).toBe("New York");
  });

  it("should recover completed fields from truncated JSON", () => {
    const raw =
      '{"building_name":"Test Tower","city":"New York","key_amenities":["Gym","Pool","Pet F';
    const result = mapLlmOutput(raw);
    expect(result.building_name?.value).toBe("Test Tower");
    expect(result.city?.value).toBe("New York");
    // truncated amenities should NOT appear
    expect(result.key_amenities).toBeUndefined();
  });

  it("should handle nested/double markdown fences", () => {
    const raw =
      '```json\n```json\n{"building_name": "Double Fenced"}\n```\n```';
    const result = mapLlmOutput(raw);
    expect(result.building_name?.value).toBe("Double Fenced");
  });

  it("should return empty object for invalid JSON", () => {
    const result = mapLlmOutput("not valid json at all");
    expect(result).toEqual({});
  });

  it("should assign confidence based on extractTier", () => {
    const raw = JSON.stringify({
      building_name: "Test", // Tier A
      description: "A nice place", // Tier B
      cancellation_policy: "No refund", // Tier C
    });

    const result = mapLlmOutput(raw);
    expect(result.building_name?.confidence).toBe("high");
    expect(result.description?.confidence).toBe("medium");
    expect(result.cancellation_policy?.confidence).toBe("low");
  });
});

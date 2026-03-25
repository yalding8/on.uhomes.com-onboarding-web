/**
 * field-validator.ts 单元测试
 */

import { describe, it, expect } from "vitest";
import { validateFields } from "./field-validator.js";
import type { ExtractedFields } from "../types.js";

describe("validateFields", () => {
  it("should pass valid fields unchanged", () => {
    const fields: ExtractedFields = {
      building_name: { value: "Test Tower", confidence: "high" },
      price_min: { value: 1200, confidence: "medium" },
      price_max: { value: 3500, confidence: "medium" },
    };

    const result = validateFields(fields);
    expect(result.fields.building_name?.value).toBe("Test Tower");
    expect(result.fields.price_min?.value).toBe(1200);
    expect(result.issues).toHaveLength(0);
  });

  it("should swap price_min and price_max if inverted", () => {
    const fields: ExtractedFields = {
      price_min: { value: 3500, confidence: "medium" },
      price_max: { value: 1200, confidence: "medium" },
    };

    const result = validateFields(fields);
    expect(result.fields.price_min?.value).toBe(1200);
    expect(result.fields.price_max?.value).toBe(3500);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].action).toBe("fix");
  });

  it("should remove values outside numeric range", () => {
    const fields: ExtractedFields = {
      year_built: { value: 1500, confidence: "medium" },
      total_units: { value: -5, confidence: "medium" },
    };

    const result = validateFields(fields);
    expect(result.fields.year_built).toBeUndefined();
    expect(result.fields.total_units).toBeUndefined();
    expect(result.removedCount).toBe(2);
  });

  it("should downgrade confidence for invalid email", () => {
    const fields: ExtractedFields = {
      primary_contact_email: {
        value: "not-an-email",
        confidence: "medium",
      },
    };

    const result = validateFields(fields);
    expect(result.fields.primary_contact_email?.confidence).toBe("low");
    expect(result.issues[0].action).toBe("downgrade");
  });

  it("should downgrade confidence for invalid URL", () => {
    const fields: ExtractedFields = {
      application_link: { value: "not-a-url", confidence: "medium" },
    };

    const result = validateFields(fields);
    expect(result.fields.application_link?.confidence).toBe("low");
  });

  it("should downgrade invalid enum values", () => {
    const fields: ExtractedFields = {
      currency: { value: "BITCOIN", confidence: "medium" },
    };

    const result = validateFields(fields);
    expect(result.fields.currency?.confidence).toBe("low");
  });

  it("should filter invalid multi_select options", () => {
    const fields: ExtractedFields = {
      key_amenities: {
        value: ["Gym", "Pool", "Hot Tub", "Sauna"],
        confidence: "medium",
      },
    };

    const result = validateFields(fields);
    // "Hot Tub" and "Sauna" are not in the allowed list
    expect(result.fields.key_amenities?.confidence).toBe("low");
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("should accept valid year_built", () => {
    const fields: ExtractedFields = {
      year_built: { value: 2020, confidence: "medium" },
    };

    const result = validateFields(fields);
    expect(result.fields.year_built?.value).toBe(2020);
    expect(result.issues).toHaveLength(0);
  });

  it("should flag suspiciously low monthly price as likely daily rate", () => {
    const fields: ExtractedFields = {
      price_min: { value: 85, confidence: "high" },
      price_period: { value: "monthly", confidence: "high" },
    };

    const result = validateFields(fields);
    expect(result.issues.some((i) => i.fieldKey === "price_period")).toBe(true);
    expect(result.fields.price_period?.confidence).toBe("low");
  });

  it("should not flag reasonable monthly price", () => {
    const fields: ExtractedFields = {
      price_min: { value: 1200, confidence: "high" },
      price_period: { value: "monthly", confidence: "high" },
    };

    const result = validateFields(fields);
    expect(result.issues.some((i) => i.fieldKey === "price_period")).toBe(
      false,
    );
  });

  it("should flag suspiciously high daily price as likely monthly rate", () => {
    const fields: ExtractedFields = {
      price_min: { value: 2500, confidence: "high" },
      price_period: { value: "daily", confidence: "high" },
    };

    const result = validateFields(fields);
    expect(result.issues.some((i) => i.fieldKey === "price_period")).toBe(true);
    expect(result.fields.price_period?.confidence).toBe("low");
  });
});

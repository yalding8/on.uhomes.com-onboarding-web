import { describe, it, expect } from "vitest";
import { toUserFriendlyErrors } from "../validation-messages";

describe("toUserFriendlyErrors", () => {
  it("returns a known hint for price_min", () => {
    const errors = [
      {
        key: "price_min",
        label: "Minimum Price",
        message: "Must be a finite number",
      },
    ];
    const result = toUserFriendlyErrors(errors);
    expect(result[0].userMessage).toBe(
      "Please enter the minimum rental price as a number",
    );
    expect(result[0].suggestion).toBe(
      "For example: 800 (without currency symbol)",
    );
  });

  it("returns a known hint for email", () => {
    const errors = [
      {
        key: "primary_contact_email",
        label: "Primary Contact Email",
        message: "Must be a valid email address",
      },
    ];
    const result = toUserFriendlyErrors(errors);
    expect(result[0].userMessage).toContain("valid email");
    expect(result[0].suggestion).toContain("leasing@");
  });

  it("returns fallback message for unknown field error", () => {
    const errors = [
      {
        key: "some_field",
        label: "Some Field",
        message: "Unknown error type",
      },
    ];
    const result = toUserFriendlyErrors(errors);
    expect(result[0].userMessage).toBe('Please check the "Some Field" field');
    expect(result[0].suggestion).toBeUndefined();
  });

  it("preserves original technical message", () => {
    const errors = [
      {
        key: "price_min",
        label: "Minimum Price",
        message: "Must be a finite number",
      },
    ];
    const result = toUserFriendlyErrors(errors);
    expect(result[0].message).toBe("Must be a finite number");
  });

  it("handles empty errors array", () => {
    expect(toUserFriendlyErrors([])).toEqual([]);
  });
});

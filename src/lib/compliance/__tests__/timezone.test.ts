import { describe, it, expect } from "vitest";
import {
  getDefaultTimezone,
  isBusinessHours,
  formatInTimezone,
} from "../timezone";

describe("getDefaultTimezone", () => {
  it("returns correct timezone for US", () => {
    expect(getDefaultTimezone("US")).toBe("America/New_York");
  });

  it("returns correct timezone for AU", () => {
    expect(getDefaultTimezone("AU")).toBe("Australia/Sydney");
  });

  it("returns correct timezone for HK", () => {
    expect(getDefaultTimezone("HK")).toBe("Asia/Hong_Kong");
  });

  it("returns correct timezone for MO", () => {
    expect(getDefaultTimezone("MO")).toBe("Asia/Macau");
  });

  it("returns UTC for unknown country", () => {
    expect(getDefaultTimezone("ZZ")).toBe("UTC");
  });

  it("is case-insensitive", () => {
    expect(getDefaultTimezone("gb")).toBe("Europe/London");
  });
});

describe("isBusinessHours", () => {
  it("returns a boolean", () => {
    const result = isBusinessHours("America/New_York");
    expect(typeof result).toBe("boolean");
  });

  it("handles valid IANA timezone", () => {
    // Just verify it doesn't throw
    expect(() => isBusinessHours("Asia/Tokyo")).not.toThrow();
    expect(() => isBusinessHours("Europe/London")).not.toThrow();
  });
});

describe("formatInTimezone", () => {
  it("formats a date in the given timezone", () => {
    const date = new Date("2026-03-15T12:00:00Z");
    const formatted = formatInTimezone(date, "America/New_York");
    // 12:00 UTC = 8:00 AM EDT (March = DST)
    expect(formatted).toContain("Mar");
    expect(formatted).toContain("2026");
  });

  it("formats correctly for Tokyo timezone", () => {
    const date = new Date("2026-03-15T12:00:00Z");
    const formatted = formatInTimezone(date, "Asia/Tokyo");
    // 12:00 UTC = 21:00 JST
    expect(formatted).toContain("Mar");
  });
});

/**
 * P3-G7: Export API helper tests — CSV escaping logic.
 */

import { describe, it, expect } from "vitest";

// Test the CSV escape logic extracted as a pure function
function csvEscape(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

describe("P3-G7: CSV export helpers", () => {
  it("does not escape plain text", () => {
    expect(csvEscape("hello")).toBe("hello");
  });

  it("escapes values with commas", () => {
    expect(csvEscape("hello, world")).toBe('"hello, world"');
  });

  it("escapes values with double quotes", () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });

  it("escapes values with newlines", () => {
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });

  it("handles empty string", () => {
    expect(csvEscape("")).toBe("");
  });
});

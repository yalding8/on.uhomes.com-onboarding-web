import { describe, it, expect } from "vitest";
import { smartTruncate } from "./llm-extractor.js";

describe("smartTruncate", () => {
  it("should return text unchanged if within limit", () => {
    const text = "Short text";
    expect(smartTruncate(text, 1000)).toBe(text);
  });

  it("should truncate long text preserving head and tail", () => {
    const text = "A".repeat(100_000);
    const result = smartTruncate(text, 60_000);
    expect(result.length).toBeLessThanOrEqual(65_000); // allow marker overhead
    expect(result).toContain("[... content condensed ...]");
  });

  it("should preserve priority keyword paragraphs from middle", () => {
    const head = "Header content.\n\n".repeat(50);
    const middle = [
      "Some random paragraph about nothing.",
      "Monthly rent pricing starts at $1,200 per bedroom.",
      "Another irrelevant paragraph.",
      "Contact us at leasing@example.com for more info.",
      "More filler text.",
    ].join("\n\n");
    const tail = "Footer content.\n\n".repeat(50);
    const text = head + middle + tail;

    const result = smartTruncate(text, 500);
    expect(result).toContain("[... content condensed ...]");
    // Priority keywords should be in the result
    expect(result).toContain("pric");
  });

  it("should handle text with no priority paragraphs", () => {
    const text = "Lorem ipsum dolor sit amet. ".repeat(5000);
    const result = smartTruncate(text, 1000);
    expect(result.length).toBeLessThanOrEqual(1200);
    expect(result).toContain("[... content condensed ...]");
  });

  it("should handle exact boundary length", () => {
    const text = "A".repeat(60_000);
    expect(smartTruncate(text, 60_000)).toBe(text);
  });

  it("should match multilingual keywords (French/German/Spanish)", () => {
    const head = "X".repeat(200);
    const middle = "\n\nLe prix du loyer est de 800€ par mois.\n\n";
    const tail = "Y".repeat(200);
    const text = head + middle + tail;

    const result = smartTruncate(text, 300);
    // French "prix" or "loyer" should be matched
    expect(result).toContain("loyer");
  });
});

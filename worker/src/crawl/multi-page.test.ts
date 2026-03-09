/**
 * multi-page.ts 单元测试
 *
 * 场景：导航链接解析、关键词匹配、去重、优先级排序、数量限制
 */

import { describe, it, expect } from "vitest";
import { discoverSubPages } from "./multi-page.js";

describe("discoverSubPages", () => {
  it("should match pricing keywords", () => {
    const result = discoverSubPages("https://example.com", [
      { href: "/pricing", text: "Pricing & Rates" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("pricing");
    expect(result[0].url).toBe("https://example.com/pricing");
  });

  it("should match amenities keywords", () => {
    const result = discoverSubPages("https://example.com", [
      { href: "/amenities", text: "Amenities & Features" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("amenities");
  });

  it("should match contact keywords", () => {
    const result = discoverSubPages("https://example.com", [
      { href: "/contact-us", text: "Contact Us" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("contact");
  });

  it("should match floor plan keywords", () => {
    const result = discoverSubPages("https://example.com", [
      { href: "/floor-plans", text: "Floor Plans" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("floor-plans");
  });

  it("should match gallery keywords", () => {
    const result = discoverSubPages("https://example.com", [
      { href: "/gallery", text: "Photo Gallery" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("gallery");
  });

  it("should match apply keywords", () => {
    const result = discoverSubPages("https://example.com", [
      { href: "/apply-now", text: "Apply Now" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("apply");
  });

  it("should sort by priority (pricing first)", () => {
    const result = discoverSubPages("https://example.com", [
      { href: "/gallery", text: "Gallery" },
      { href: "/pricing", text: "Pricing" },
      { href: "/amenities", text: "Amenities" },
      { href: "/contact", text: "Contact" },
    ]);
    expect(result[0].label).toBe("pricing");
    expect(result[1].label).toBe("amenities");
    expect(result[2].label).toBe("contact");
    expect(result[3].label).toBe("gallery");
  });

  it("should limit to 6 sub-pages", () => {
    const links = [
      { href: "/pricing", text: "Pricing" },
      { href: "/amenities", text: "Amenities" },
      { href: "/contact", text: "Contact" },
      { href: "/floor-plans", text: "Floor Plans" },
      { href: "/gallery", text: "Gallery" },
      { href: "/apply", text: "Apply" },
      { href: "/rates", text: "Rates" },
      { href: "/features", text: "Features" },
    ];
    const result = discoverSubPages("https://example.com", links);
    expect(result.length).toBeLessThanOrEqual(6);
  });

  it("should deduplicate by resolved URL", () => {
    const result = discoverSubPages("https://example.com", [
      { href: "/pricing", text: "Pricing" },
      { href: "/pricing/", text: "View Pricing" },
      { href: "https://example.com/pricing", text: "Our Rates" },
    ]);
    expect(result.filter((r) => r.label === "pricing")).toHaveLength(1);
  });

  it("should resolve relative URLs against base", () => {
    const result = discoverSubPages("https://example.com/apartments", [
      { href: "/amenities", text: "Amenities" },
    ]);
    expect(result[0].url).toBe("https://example.com/amenities");
  });

  it("should skip external domain links", () => {
    const result = discoverSubPages("https://example.com", [
      { href: "https://other-site.com/pricing", text: "Pricing" },
    ]);
    expect(result).toHaveLength(0);
  });

  it("should skip non-http links", () => {
    const result = discoverSubPages("https://example.com", [
      { href: "mailto:info@example.com", text: "Contact" },
      { href: "tel:+1234567890", text: "Call Us" },
      { href: "#section", text: "Amenities" },
    ]);
    expect(result).toHaveLength(0);
  });

  it("should return empty array when no matching links", () => {
    const result = discoverSubPages("https://example.com", [
      { href: "/about", text: "About Us" },
      { href: "/team", text: "Our Team" },
    ]);
    expect(result).toHaveLength(0);
  });

  it("should handle empty nav links", () => {
    const result = discoverSubPages("https://example.com", []);
    expect(result).toHaveLength(0);
  });
});

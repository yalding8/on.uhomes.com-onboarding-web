import { describe, it, expect } from "vitest";
import { extractWithCss } from "./css-extractor.js";

const makeHtml = (body: string) =>
  `<html><head></head><body>${body}</body></html>`;

describe("extractWithCss", () => {
  it("should extract email from mailto link", () => {
    const html = makeHtml('<a href="mailto:info@apt.com">Email us</a>');
    const fields = extractWithCss(html);
    expect(fields.primary_contact_email?.value).toBe("info@apt.com");
    expect(fields.primary_contact_email?.confidence).toBe("medium");
  });

  it("should strip query params from mailto", () => {
    const html = makeHtml(
      '<a href="mailto:info@apt.com?subject=Hello">Email</a>',
    );
    const fields = extractWithCss(html);
    expect(fields.primary_contact_email?.value).toBe("info@apt.com");
  });

  it("should extract phone from tel link", () => {
    const html = makeHtml('<a href="tel:+15551234567">Call us</a>');
    const fields = extractWithCss(html);
    expect(fields.primary_contact_phone?.value).toBe("+15551234567");
  });

  it("should extract address from itemprop", () => {
    const html = makeHtml('<span itemprop="streetAddress">123 Main St</span>');
    const fields = extractWithCss(html);
    expect(fields.building_address?.value).toBe("123 Main St");
  });

  it("should extract city from itemprop", () => {
    const html = makeHtml('<span itemprop="addressLocality">Austin</span>');
    const fields = extractWithCss(html);
    expect(fields.city?.value).toBe("Austin");
  });

  it("should extract price from itemprop lowPrice", () => {
    const html = makeHtml('<span itemprop="lowPrice">$1,200</span>');
    const fields = extractWithCss(html);
    expect(fields.price_min?.value).toBe(1200);
  });

  it("should extract amenities list and normalize", () => {
    const html = makeHtml(`
      <ul class="amenities">
        <li>Swimming Pool</li>
        <li>Fitness Center</li>
        <li>Free WiFi</li>
        <li>24/7 Security</li>
      </ul>
    `);
    const fields = extractWithCss(html);
    const amenities = fields.key_amenities?.value as string[];
    expect(amenities).toContain("Pool");
    expect(amenities).toContain("Gym");
    expect(amenities).toContain("WiFi");
    expect(amenities).toContain("Security");
  });

  it("should extract gallery images", () => {
    const html = makeHtml(`
      <div class="gallery">
        <img src="https://example.com/1.jpg">
        <img src="https://example.com/2.jpg">
        <img src="data:image/gif;base64,xxx">
      </div>
    `);
    const fields = extractWithCss(html);
    const images = fields.images?.value as string[];
    expect(images).toHaveLength(2);
    expect(images).toContain("https://example.com/1.jpg");
  });

  it("should apply platform rules for entrata", () => {
    const html = makeHtml(
      '<span class="rent-range"><span class="min-rent">$900</span></span>',
    );
    const fields = extractWithCss(html, "entrata");
    expect(fields.price_min?.value).toBe(900);
    expect(fields.price_min?.confidence).toBe("high");
  });

  it("should prefer platform rules over generic", () => {
    const html = makeHtml(`
      <span class="rent-range"><span class="min-rent">$900</span></span>
      <span itemprop="lowPrice">$800</span>
    `);
    const fields = extractWithCss(html, "entrata");
    expect(fields.price_min?.value).toBe(900);
  });

  it("should return empty for no matches", () => {
    const html = makeHtml("<p>No structured data here</p>");
    const fields = extractWithCss(html);
    expect(Object.keys(fields)).toHaveLength(0);
  });

  it("should skip empty text values", () => {
    const html = makeHtml('<span itemprop="streetAddress">   </span>');
    const fields = extractWithCss(html);
    expect(fields.building_address).toBeUndefined();
  });

  it("should handle amenity fuzzy matching", () => {
    const html = makeHtml(`
      <ul class="features">
        <li>Fully Furnished Rooms</li>
        <li>Underground Bike Storage</li>
        <li>Rooftop Terrace</li>
      </ul>
    `);
    const fields = extractWithCss(html);
    const amenities = fields.key_amenities?.value as string[];
    expect(amenities).toContain("Furnished");
    expect(amenities).toContain("Bike Storage");
    expect(amenities).toContain("Rooftop");
  });
});

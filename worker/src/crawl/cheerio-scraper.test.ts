/**
 * cheerio-scraper.ts 单元测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { scrapeWithCheerio, parseHtml } from "./cheerio-scraper.js";

const SAMPLE_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Sunset Apartments</title>
  <meta property="og:title" content="Sunset Apartments - Luxury Living">
  <meta property="og:image" content="https://example.com/hero.jpg">
  <script type="application/ld+json">
  {
    "@type": "ApartmentComplex",
    "name": "Sunset Apartments",
    "telephone": "555-1234"
  }
  </script>
</head>
<body>
  <header>Header content</header>
  <nav>
    <a href="/pricing">Pricing</a>
    <a href="/amenities">Amenities</a>
  </nav>
  <main>
    <h1>Welcome to Sunset Apartments</h1>
    <p>Beautiful apartments in downtown.</p>
    <img src="https://example.com/photo1.jpg" alt="Pool">
    <img src="https://example.com/photo2.jpg" alt="Gym">
    <img src="data:image/gif;base64,R0lGODlh" alt="spacer">
  </main>
  <footer>Footer content</footer>
  <script>console.log('test');</script>
  <style>.hidden { display: none; }</style>
</body>
</html>`;

describe("parseHtml", () => {
  it("should extract title", () => {
    const result = parseHtml(SAMPLE_HTML);
    expect(result.title).toBe("Sunset Apartments");
  });

  it("should extract body text without noise elements", () => {
    const result = parseHtml(SAMPLE_HTML);
    expect(result.bodyText).toContain("Beautiful apartments");
    expect(result.bodyText).not.toContain("console.log");
    expect(result.bodyText).not.toContain(".hidden");
  });

  it("should extract images, filtering data URIs", () => {
    const result = parseHtml(SAMPLE_HTML);
    expect(result.imageUrls).toContain("https://example.com/photo1.jpg");
    expect(result.imageUrls).toContain("https://example.com/photo2.jpg");
    expect(result.imageUrls).not.toContain("data:image/gif;base64,R0lGODlh");
  });

  it("should extract JSON-LD", () => {
    const result = parseHtml(SAMPLE_HTML);
    expect(result.jsonLd).toHaveLength(1);
    expect(result.jsonLd[0]["@type"]).toBe("ApartmentComplex");
    expect(result.jsonLd[0].name).toBe("Sunset Apartments");
  });

  it("should extract OpenGraph metadata", () => {
    const result = parseHtml(SAMPLE_HTML);
    expect(result.openGraph.title).toBe("Sunset Apartments - Luxury Living");
    expect(result.openGraph.image).toBe("https://example.com/hero.jpg");
  });

  it("should extract nav links from <nav>", () => {
    const result = parseHtml(SAMPLE_HTML);
    expect(result.navLinks).toContainEqual({
      href: "/pricing",
      text: "Pricing",
    });
    expect(result.navLinks).toContainEqual({
      href: "/amenities",
      text: "Amenities",
    });
  });

  it("should extract links from header when no <nav>", () => {
    const html = `<html><head><title>T</title></head><body>
      <header><a href="/rates">Rates</a><a href="/contact">Contact</a></header>
      <main><p>Content</p></main>
    </body></html>`;
    const result = parseHtml(html);
    expect(result.navLinks).toContainEqual({ href: "/rates", text: "Rates" });
    expect(result.navLinks).toContainEqual({
      href: "/contact",
      text: "Contact",
    });
  });

  it("should fallback to all links when no nav/header links", () => {
    const html = `<html><head><title>T</title></head><body>
      <div><a href="/pricing">Pricing</a><a href="/about">About</a></div>
    </body></html>`;
    const result = parseHtml(html);
    expect(result.navLinks.length).toBeGreaterThanOrEqual(2);
  });

  it("should extract contactText from footer/header", () => {
    const result = parseHtml(SAMPLE_HTML);
    expect(result.contactText).toContain("Header content");
    expect(result.contactText).toContain("Footer content");
  });

  it("should extract metaTags", () => {
    const html = `<html><head>
      <title>T</title>
      <meta name="twitter:title" content="Apartments">
      <meta name="description" content="Best apartments">
    </head><body><p>Content</p></body></html>`;
    const result = parseHtml(html);
    expect(result.metaTags.twitter_title).toBe("Apartments");
    expect(result.metaTags.meta_description).toBe("Best apartments");
  });

  it("should convert HTML to markdown", () => {
    const result = parseHtml(SAMPLE_HTML);
    expect(result.markdown).toContain("# Welcome to Sunset Apartments");
    expect(result.markdown).toContain("Beautiful apartments");
  });

  it("should handle invalid JSON-LD gracefully", () => {
    const html = `<html><head>
      <title>Test</title>
      <script type="application/ld+json">{ invalid json }</script>
    </head><body><p>Content</p></body></html>`;
    const result = parseHtml(html);
    expect(result.jsonLd).toHaveLength(0);
  });

  it("should handle empty HTML", () => {
    const result = parseHtml("<html><head></head><body></body></html>");
    expect(result.title).toBe("");
    expect(result.bodyText).toBe("");
    expect(result.imageUrls).toHaveLength(0);
    expect(result.jsonLd).toHaveLength(0);
  });

  it("should extract picture source srcset", () => {
    const html = `<html><head><title>T</title></head><body>
      <picture>
        <source srcset="https://example.com/large.webp 1200w, https://example.com/small.webp 600w">
      </picture>
    </body></html>`;
    const result = parseHtml(html);
    expect(result.imageUrls).toContain("https://example.com/large.webp");
  });

  it("should filter favicon and pixel images", () => {
    const html = `<html><head><title>T</title></head><body>
      <img src="https://example.com/favicon.ico">
      <img src="https://example.com/pixel.gif">
      <img src="https://example.com/1x1.png">
      <img src="https://example.com/spacer.gif">
      <img src="https://example.com/real-photo.jpg">
    </body></html>`;
    const result = parseHtml(html);
    expect(result.imageUrls).toEqual(["https://example.com/real-photo.jpg"]);
  });
});

describe("scrapeWithCheerio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch and parse HTML", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(SAMPLE_HTML),
    });

    const result = await scrapeWithCheerio("https://example.com");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.title).toBe("Sunset Apartments");
    expect(result.jsonLd).toHaveLength(1);
  });

  it("should throw on HTTP error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
    });

    await expect(
      scrapeWithCheerio("https://example.com/missing"),
    ).rejects.toThrow("HTTP 404");
  });

  it("should pass abort signal to fetch", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(SAMPLE_HTML),
    });

    const controller = new AbortController();
    await scrapeWithCheerio("https://example.com", controller.signal);

    const fetchOptions = mockFetch.mock.calls[0][1];
    expect(fetchOptions.signal).toBe(controller.signal);
  });
});

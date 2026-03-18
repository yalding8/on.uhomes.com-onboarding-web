import { describe, it, expect } from "vitest";
import { pruneBoilerplate, computeTextDensity } from "./dom-pruner.js";

describe("computeTextDensity", () => {
  it("should return high density for text-heavy elements", () => {
    const html =
      "<p>This is a long paragraph with lots of useful content about apartment amenities and pricing.</p>";
    const density = computeTextDensity(html);
    expect(density.textDensity).toBeGreaterThan(0.5);
  });

  it("should return low density for tag-heavy elements", () => {
    const html =
      '<div class="nav"><ul><li><a href="/a">A</a></li><li><a href="/b">B</a></li><li><a href="/c">C</a></li></ul></div>';
    const density = computeTextDensity(html);
    expect(density.textDensity).toBeLessThan(0.3);
  });

  it("should detect high link density for navigation", () => {
    const html =
      '<div><a href="/a">Link1</a> <a href="/b">Link2</a> <a href="/c">Link3</a></div>';
    const density = computeTextDensity(html);
    expect(density.linkDensity).toBeGreaterThan(0.5);
  });
});

describe("pruneBoilerplate", () => {
  it("should remove cookie banners", () => {
    const html =
      '<body><div class="content"><p>Great apartments with pools</p></div><div class="cookie-banner">We use cookies</div></body>';
    const result = pruneBoilerplate(html);
    expect(result).toContain("Great apartments");
    expect(result).not.toContain("cookie");
  });

  it("should remove navigation-heavy low-density blocks", () => {
    const html = `<body>
      <div class="nav-wrapper"><ul><li><a href="/1">Home</a></li><li><a href="/2">About</a></li><li><a href="/3">Contact</a></li><li><a href="/4">FAQ</a></li><li><a href="/5">Blog</a></li></ul></div>
      <div class="main"><p>Beautiful studio apartments starting at $1,500/month with gym, pool, and rooftop access. Located at 123 Main St, New York, NY 10001.</p></div>
    </body>`;
    const result = pruneBoilerplate(html);
    expect(result).toContain("Beautiful studio");
    expect(result).not.toContain("nav-wrapper");
  });

  it("should preserve tables even if low density", () => {
    const html = `<body>
      <div class="pricing"><table><tr><th>Unit</th><th>Price</th></tr><tr><td>Studio</td><td>$1,500</td></tr></table></div>
      <div class="sidebar"><a href="/a">Ad 1</a><a href="/b">Ad 2</a><a href="/c">Ad 3</a></div>
    </body>`;
    const result = pruneBoilerplate(html);
    expect(result).toContain("table");
    expect(result).toContain("Studio");
  });

  it("should remove known boilerplate selectors", () => {
    const html = `<body>
      <div class="content"><p>Luxury apartments in Manhattan</p></div>
      <div class="ad-container">Buy something</div>
      <div class="popup">Subscribe now!</div>
      <div role="complementary">Sidebar widget</div>
    </body>`;
    const result = pruneBoilerplate(html);
    expect(result).toContain("Luxury apartments");
    expect(result).not.toContain("ad-container");
    expect(result).not.toContain("Subscribe now");
    expect(result).not.toContain("Sidebar widget");
  });

  it("should return content unchanged if no boilerplate detected", () => {
    const html =
      "<body><div><p>Pure content about apartments with many details about pricing and amenities.</p></div></body>";
    const result = pruneBoilerplate(html);
    expect(result).toContain("Pure content");
  });
});

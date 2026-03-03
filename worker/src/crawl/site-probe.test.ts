/**
 * site-probe.ts 单元测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { probeSite } from "./site-probe.js";

function htmlResponse(html: string, status = 200) {
  return {
    status,
    url: "https://example.com",
    headers: new Headers({ "content-type": "text/html" }),
    text: () => Promise.resolve(html),
  };
}

describe("probeSite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should detect static HTML site", async () => {
    mockFetch.mockResolvedValue(
      htmlResponse(`
      <html><body>
        <h1>Welcome to Apartments</h1>
        <p>Lots of content here describing the property in detail.</p>
        <p>More text to ensure this is not detected as SPA shell.</p>
      </body></html>
    `),
    );

    const profile = await probeSite("https://example.com");
    expect(profile.type).toBe("static");
    expect(profile.estimatedComplexity).toBe("simple");
  });

  it("should detect SPA with empty shell", async () => {
    mockFetch.mockResolvedValue(
      htmlResponse(`
      <html><body>
        <div id="root"></div>
        <script src="/static/js/main.abc123.js"></script>
      </body></html>
    `),
    );

    const profile = await probeSite("https://example.com");
    expect(profile.type).toBe("spa");
    expect(profile.estimatedComplexity).toBe("complex");
  });

  it("should detect WordPress site", async () => {
    mockFetch.mockResolvedValue(
      htmlResponse(`
      <html><body>
        <link rel="stylesheet" href="/wp-content/themes/flavor/style.css">
        <h1>Our Apartments</h1>
        <p>Welcome to the best apartments in town.</p>
      </body></html>
    `),
    );

    const profile = await probeSite("https://example.com");
    expect(profile.type).toBe("wordpress");
  });

  it("should detect platform template", async () => {
    mockFetch.mockResolvedValue(
      htmlResponse(`
      <html><body>
        <script src="https://cdn.entrata.com/widget.js"></script>
        <h1>Luxury Living</h1>
      </body></html>
    `),
    );

    const profile = await probeSite("https://example.com");
    expect(profile.type).toBe("platform_template");
  });

  it("should detect JSON-LD presence", async () => {
    mockFetch.mockResolvedValue(
      htmlResponse(`
      <html><head>
        <script type="application/ld+json">{"@type":"ApartmentComplex"}</script>
      </head><body><p>Content</p></body></html>
    `),
    );

    const profile = await probeSite("https://example.com");
    expect(profile.hasJsonLd).toBe(true);
  });

  it("should detect OpenGraph tags", async () => {
    mockFetch.mockResolvedValue(
      htmlResponse(`
      <html><head>
        <meta property="og:title" content="Apartments">
      </head><body><p>Content</p></body></html>
    `),
    );

    const profile = await probeSite("https://example.com");
    expect(profile.hasOpenGraph).toBe(true);
  });

  it("should detect Next.js framework", async () => {
    mockFetch.mockResolvedValue(
      htmlResponse(`
      <html><body>
        <div id="__next"><h1>Next App</h1></div>
        <script id="__NEXT_DATA__" type="application/json">{}</script>
      </body></html>
    `),
    );

    const profile = await probeSite("https://example.com");
    expect(profile.framework).toBe("next");
  });

  it("should handle HTTP errors gracefully", async () => {
    mockFetch.mockResolvedValue(htmlResponse("Not Found", 404));

    const profile = await probeSite("https://example.com/404");
    expect(profile.httpStatus).toBe(404);
    expect(profile.estimatedComplexity).toBe("complex");
  });

  it("should handle network errors gracefully", async () => {
    mockFetch.mockRejectedValue(new Error("Network timeout"));

    const profile = await probeSite("https://unreachable.com");
    expect(profile.type).toBe("unknown");
    expect(profile.estimatedComplexity).toBe("complex");
  });
});

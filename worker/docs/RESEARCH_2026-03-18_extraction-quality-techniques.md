# Web Data Extraction Quality Improvement Techniques

**Date**: 2026-03-18
**Goal**: Maximize field count and extraction quality WITHOUT changing LLM models
**Stack**: Node.js, Playwright, Cheerio

---

## Priority Matrix

| #   | Technique                                       | Impact  | Effort | New Deps? | Priority |
| --- | ----------------------------------------------- | ------- | ------ | --------- | -------- |
| 1   | Schema-Driven CSS Extraction (pre-LLM)          | HIGH    | Medium | No        | P0       |
| 2   | Structured Data Harvesting (Schema.org/JSON-LD) | HIGH    | Low    | No        | P0       |
| 3   | HTML Preprocessing & Boilerplate Removal        | HIGH    | Low    | Minimal   | P0       |
| 4   | Few-Shot Examples in LLM Prompts                | HIGH    | Low    | No        | P0       |
| 5   | Prompt Engineering for Field Maximization       | HIGH    | Low    | No        | P0       |
| 6   | Multi-Level Depth Crawling (subpages)           | HIGH    | Medium | No        | P1       |
| 7   | API Interception via Playwright                 | HIGH    | Medium | No        | P1       |
| 8   | Confidence Scoring & Validation                 | MEDIUM  | Medium | No        | P1       |
| 9   | Self-Healing Selectors                          | MEDIUM  | High   | Optional  | P2       |
| 10  | Schema-Constrained LLM Output (Zod)             | MEDIUM  | Low    | zod       | P1       |
| 11  | Vision Model Fallback (screenshots)             | LOW-MED | High   | Optional  | P3       |
| 12  | Content Extraction Algorithms                   | MEDIUM  | Low    | Minimal   | P2       |

---

## 1. Schema-Driven CSS Extraction (Pre-LLM Layer)

### What It Is

Define a JSON schema mapping CSS selectors to fields. Extract all deterministic data BEFORE sending anything to the LLM. Crawl4AI's `JsonCssExtractionStrategy` demonstrates this: you specify a `baseSelector` (e.g., `div.listing-detail`), then declare fields with types like `text`, `attribute`, `html`, `nested`, `nested_list`, `list`, and `regex`.

### Concrete Implementation for Apartment Crawler

```typescript
// Define per-site extraction schemas
const apartmentSchema = {
  name: "ApartmentListing",
  baseSelector: "div.property-detail, main.listing",
  fields: [
    {
      name: "title",
      selector: "h1, [data-testid='property-title']",
      type: "text",
    },
    {
      name: "address",
      selector: "[itemprop='address'], .property-address",
      type: "text",
    },
    {
      name: "price",
      selector: "[data-testid='price'], .rent-price",
      type: "text",
      pattern: /\$[\d,]+/,
    },
    { name: "bedrooms", selector: ".beds, [data-testid='beds']", type: "text" },
    {
      name: "bathrooms",
      selector: ".baths, [data-testid='baths']",
      type: "text",
    },
    { name: "sqft", selector: ".sqft, [data-testid='sqft']", type: "text" },
    {
      name: "images",
      selector: "img.gallery-image",
      type: "list",
      attribute: "src",
    },
    {
      name: "amenities",
      selector: ".amenity-item, .feature-list li",
      type: "list",
    },
    {
      name: "description",
      selector: ".description, [data-testid='description']",
      type: "html",
    },
    {
      name: "phone",
      selector: "a[href^='tel:']",
      type: "attribute",
      attribute: "href",
    },
    {
      name: "coordinates",
      selector: "[data-lat]",
      type: "attribute",
      attribute: "data-lat",
    },
    {
      name: "floorPlans",
      selector: ".floor-plan-card",
      type: "nested_list",
      fields: [
        { name: "name", selector: ".plan-name", type: "text" },
        { name: "price", selector: ".plan-price", type: "text" },
        { name: "beds", selector: ".plan-beds", type: "text" },
        { name: "sqft", selector: ".plan-sqft", type: "text" },
      ],
    },
  ],
};

// Implement a generic schema executor with Cheerio
function extractBySchema(
  html: string,
  schema: ExtractionSchema,
): Record<string, any> {
  const $ = cheerio.load(html);
  const container = $(schema.baseSelector).first();
  if (!container.length) return {};

  const result: Record<string, any> = {};
  for (const field of schema.fields) {
    switch (field.type) {
      case "text":
        result[field.name] = container
          .find(field.selector)
          .first()
          .text()
          .trim();
        if (field.pattern) {
          const match = result[field.name].match(field.pattern);
          result[field.name] = match ? match[0] : result[field.name];
        }
        break;
      case "attribute":
        result[field.name] = container
          .find(field.selector)
          .first()
          .attr(field.attribute);
        break;
      case "list":
        result[field.name] = container
          .find(field.selector)
          .map((_, el) =>
            field.attribute ? $(el).attr(field.attribute) : $(el).text().trim(),
          )
          .get();
        break;
      case "nested_list":
        result[field.name] = container
          .find(field.selector)
          .map((_, el) => extractNestedFields($, $(el), field.fields))
          .get();
        break;
    }
  }
  return result;
}
```

### Expected Impact

- **+30-50% more fields** extracted deterministically (price, address, beds, baths, sqft, phone, amenities lists)
- **Reduces LLM token usage** by only sending unresolved fields to the LLM
- **Zero hallucination** for CSS-extracted fields
- **Speed**: Cheerio parses in <50ms vs 2-10s for LLM calls

### Dependencies

None new. Uses existing Cheerio.

---

## 2. Structured Data Harvesting (Schema.org / JSON-LD)

### What It Is

Many apartment sites embed `<script type="application/ld+json">` with Schema.org structured data (RealEstateListing, ApartmentComplex, LocalBusiness, Product). This data is machine-readable, validated, and often MORE COMPLETE than what's visible on the page.

### Concrete Implementation

```typescript
function extractJsonLd(html: string): Record<string, any>[] {
  const $ = cheerio.load(html);
  const results: Record<string, any>[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || "");
      // Handle @graph arrays
      if (data["@graph"]) {
        results.push(...data["@graph"]);
      } else {
        results.push(data);
      }
    } catch {}
  });

  return results;
}

function mapSchemaOrgToApartment(
  jsonLd: Record<string, any>[],
): Partial<ApartmentData> {
  const result: Partial<ApartmentData> = {};

  for (const item of jsonLd) {
    const type = item["@type"];

    if (
      [
        "ApartmentComplex",
        "Apartment",
        "RealEstateListing",
        "Residence",
      ].includes(type)
    ) {
      result.name = item.name;
      result.description = item.description;
      result.url = item.url;

      if (item.address) {
        result.address = item.address.streetAddress;
        result.city = item.address.addressLocality;
        result.state = item.address.addressRegion;
        result.zip = item.address.postalCode;
      }

      if (item.geo) {
        result.latitude = item.geo.latitude;
        result.longitude = item.geo.longitude;
      }

      result.phone = item.telephone;
      result.image = item.image;
      result.numberOfRooms = item.numberOfRooms;
      result.floorSize = item.floorSize?.value;
    }

    if (type === "LocalBusiness" || type === "Organization") {
      result.managementCompany = item.name;
      result.phone = result.phone || item.telephone;
      result.email = item.email;
      result.openingHours = item.openingHoursSpecification;
    }

    if (item.offers || item.containsPlace) {
      // RealEstateListing offers contain price/availability
      const offers = item.offers || item.containsPlace;
      if (Array.isArray(offers)) {
        result.floorPlans = offers.map((o) => ({
          price: o.price || o.priceRange,
          availability: o.availability,
          name: o.name,
        }));
      }
    }
  }

  return result;
}

// Also extract microdata and RDFa
function extractMicrodata(html: string): Record<string, any> {
  const $ = cheerio.load(html);
  const result: Record<string, any> = {};
  $("[itemprop]").each((_, el) => {
    const prop = $(el).attr("itemprop");
    const content = $(el).attr("content") || $(el).text().trim();
    if (prop && content) result[prop] = content;
  });
  return result;
}
```

### Expected Impact

- **+20-40% more fields** on sites that implement Schema.org (many apartment sites do for SEO)
- **Perfect accuracy** - this is the site's own structured data
- **Free fields**: latitude, longitude, phone, hours, management company, price ranges
- Common on: Apartments.com, Zillow, Rent.com, individual property management sites

### Dependencies

None new. JSON.parse + Cheerio.

---

## 3. HTML Preprocessing & Boilerplate Removal

### What It Is

Before sending HTML to the LLM, aggressively strip boilerplate (nav, footer, ads, scripts) and convert to clean Markdown. This reduces token usage by ~70% while improving extraction quality because the LLM sees only relevant content.

### Concrete Implementation

```typescript
function preprocessHtml(html: string): { cleanHtml: string; markdown: string } {
  const $ = cheerio.load(html);

  // Phase 1: Remove noise elements
  const removeSelectors = [
    "script",
    "style",
    "noscript",
    "iframe",
    "nav",
    "footer",
    "header:not(:has(h1))",
    ".cookie-banner",
    ".popup",
    ".modal",
    ".advertisement",
    ".ad",
    '[class*="sidebar"]',
    '[class*="social"]',
    '[class*="share"]',
    '[class*="newsletter"]',
    '[class*="subscribe"]',
    "svg:not(.icon)",
    '[role="navigation"]',
    '[role="banner"]',
    '[role="complementary"]',
    "form:not(.contact-form):not(.inquiry-form)",
  ];

  for (const sel of removeSelectors) {
    $(sel).remove();
  }

  // Phase 2: Preserve structure but simplify attributes
  $("*").each((_, el) => {
    const elem = $(el);
    const keepAttrs = [
      "href",
      "src",
      "alt",
      "data-testid",
      "itemprop",
      "class",
      "id",
      "data-lat",
      "data-lng",
      "aria-label",
    ];
    const attrs = Object.keys(el.attribs || {});
    for (const attr of attrs) {
      if (!keepAttrs.includes(attr) && !attr.startsWith("data-")) {
        elem.removeAttr(attr);
      }
    }
  });

  // Phase 3: Collapse whitespace
  let cleanHtml = $.html();
  cleanHtml = cleanHtml.replace(/\s+/g, " ").replace(/>\s+</g, "><");

  // Phase 4: Convert to Markdown (use turndown or similar)
  const markdown = htmlToMarkdown(cleanHtml);

  return { cleanHtml, markdown };
}

// Targeted content extraction: find the main content area
function findMainContent($: cheerio.CheerioAPI): cheerio.Cheerio {
  // Priority order for main content detection
  const mainSelectors = [
    "main",
    '[role="main"]',
    "article",
    ".property-detail",
    ".listing-detail",
    "#content",
    ".content",
    ".main-content",
    ".property-info",
    ".apartment-details",
  ];

  for (const sel of mainSelectors) {
    const el = $(sel);
    if (el.length && el.text().trim().length > 200) return el;
  }

  // Fallback: find the div with the most text content
  let maxTextLen = 0;
  let bestEl = $("body");
  $("div").each((_, el) => {
    const textLen = $(el).text().trim().length;
    if (textLen > maxTextLen && textLen < 50000) {
      maxTextLen = textLen;
      bestEl = $(el);
    }
  });
  return bestEl;
}
```

### Expected Impact

- **Token reduction**: 60-70% fewer tokens sent to LLM
- **Quality boost**: LLM focuses on content, not nav/ads noise
- **Fewer hallucinations**: Less irrelevant text = less confusion
- Trafilatura (Python) achieves F1 0.937 for content extraction; the JS equivalent achieves ~90%

### Dependencies

Minimal. `turndown` (HTML-to-Markdown, 0 deps) or build simple converter.

---

## 4. Few-Shot Examples in LLM Prompts

### What It Is

Include 1-3 concrete input/output examples in the extraction prompt. Research shows few-shot outperforms zero-shot for structured extraction, especially for domain-specific fields. The LLM learns the expected output format, field naming conventions, and edge case handling from examples.

### Concrete Implementation

```typescript
const EXTRACTION_PROMPT = `You are extracting apartment listing data from a webpage.

## Example 1
INPUT (snippet):
"""
<h1>Parkview Apartments</h1>
<p class="address">123 Oak St, Austin, TX 78701</p>
<div class="pricing">Studios from $1,200 | 1BR from $1,500 | 2BR from $2,100</div>
<ul class="amenities"><li>Pool</li><li>Gym</li><li>Pet Friendly</li></ul>
<p>Built in 2019. 250 units. Managed by Greystar.</p>
"""

OUTPUT:
{
  "name": "Parkview Apartments",
  "address": "123 Oak St",
  "city": "Austin",
  "state": "TX",
  "zip": "78701",
  "floorPlans": [
    {"type": "Studio", "minPrice": 1200},
    {"type": "1 Bedroom", "minPrice": 1500},
    {"type": "2 Bedroom", "minPrice": 2100}
  ],
  "amenities": ["Pool", "Gym", "Pet Friendly"],
  "yearBuilt": 2019,
  "totalUnits": 250,
  "managementCompany": "Greystar",
  "petPolicy": "Pet Friendly"
}

## Example 2
INPUT (snippet):
"""
<div class="community-info">
  <h2>The Metropolitan at Downtown</h2>
  <span>789 Main Blvd, Seattle, WA 98101</span>
  <div>Call us: (206) 555-0123</div>
  <div>Office Hours: Mon-Fri 9am-6pm, Sat 10am-5pm</div>
  <div>1 Bed: $1,800-$2,200 | 2 Bed: $2,400-$3,000</div>
  <p>Utilities included: Water, Trash. Parking: $150/mo</p>
</div>
"""

OUTPUT:
{
  "name": "The Metropolitan at Downtown",
  "address": "789 Main Blvd",
  "city": "Seattle",
  "state": "WA",
  "zip": "98101",
  "phone": "(206) 555-0123",
  "officeHours": "Mon-Fri 9am-6pm, Sat 10am-5pm",
  "floorPlans": [
    {"type": "1 Bedroom", "minPrice": 1800, "maxPrice": 2200},
    {"type": "2 Bedroom", "minPrice": 2400, "maxPrice": 3000}
  ],
  "utilitiesIncluded": ["Water", "Trash"],
  "parkingCost": 150
}

Now extract ALL available data from the following apartment listing webpage. Return EVERY field you can identify, even if not shown in examples above. Be thorough.

INPUT:
"""
{content}
"""

OUTPUT:`;
```

### Expected Impact

- **+15-25% more fields** extracted (LLM learns to look for fields like yearBuilt, parkingCost, utilitiesIncluded from examples)
- **Better formatting consistency** (price as numbers, addresses properly split)
- **Fewer missed fields**: examples teach the LLM what's "interesting" to extract from apartment listings specifically

### Dependencies

None.

---

## 5. Prompt Engineering for Field Maximization

### What It Is

Structure the prompt to explicitly enumerate desired fields and use techniques like chain-of-thought and exhaustive-extraction instructions. Research shows that explicit field lists in prompts dramatically increase extraction completeness.

### Concrete Implementation

```typescript
const FIELD_MAXIMIZING_PROMPT = `Extract ALL apartment listing data from this webpage content.

## Required Fields (extract if present)
- name: Property name
- address, city, state, zip: Full address broken down
- phone, email, website: Contact info
- latitude, longitude: Coordinates
- floorPlans[]: Array with type, beds, baths, sqft, minPrice, maxPrice, availability
- amenities[]: All amenities (pool, gym, parking, laundry, etc.)
- petPolicy: Pet rules, deposits, breed restrictions
- parkingInfo: Type (garage/surface/covered), cost
- utilitiesIncluded[]: Which utilities are included
- officeHours: Leasing office hours
- yearBuilt: Construction year
- totalUnits: Number of units
- managementCompany: Property management company
- deposit: Security deposit amount
- leaseLengths[]: Available lease terms (e.g., "6 months", "12 months")
- moveInSpecials: Any current promotions
- neighborhood: Neighborhood name
- nearbyTransit[]: Nearby transit options
- walkScore, transitScore: Walkability/transit scores if shown
- images[]: Image URLs
- virtualTourUrl: Virtual tour link
- applicationFee: Application fee amount
- incomeRequirement: Income requirements

## Instructions
1. First scan the ENTIRE content for any data matching the fields above.
2. Then look for ANY additional fields not in the list above - apartment listings often contain unique information.
3. For prices, extract as numbers (remove $ and commas).
4. For arrays (amenities, floorPlans), be exhaustive - include EVERY item.
5. If a field is not present, omit it (do not include null values).
6. Return valid JSON only.`;
```

### Expected Impact

- **+20-30% more fields** vs generic "extract data" prompts
- **Explicit field enumeration prevents the LLM from "forgetting" fields** it might otherwise skip
- **Consistent output structure** across different sites

### Dependencies

None.

---

## 6. Multi-Level Depth Crawling (Subpages)

### What It Is

Most apartment sites split data across multiple pages: listing page, floor plans page, amenities page, gallery page, neighborhood page. Crawling only the main URL misses 40-60% of available data. Crawl subpage links to get the complete picture.

### Concrete Implementation

```typescript
interface CrawlPlan {
  mainUrl: string;
  subpagePatterns: RegExp[];
  subpageSelectors: string[];
}

async function deepCrawlApartment(
  page: playwright.Page,
  url: string,
): Promise<ApartmentData> {
  // Step 1: Crawl main page
  await page.goto(url, { waitUntil: "networkidle" });
  const mainHtml = await page.content();
  const mainData = extractFromHtml(mainHtml);

  // Step 2: Discover subpage links
  const subpageLinks = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll("a[href]"));
    const subpagePatterns = [
      /floor-?plans/i,
      /amenities/i,
      /gallery|photos/i,
      /neighborhood|location/i,
      /pricing/i,
      /virtual-?tour/i,
      /pet-?policy/i,
      /contact/i,
      /specials|promotions/i,
    ];

    return links
      .map((a) => ({ href: a.href, text: a.textContent?.trim() || "" }))
      .filter((link) =>
        subpagePatterns.some((p) => p.test(link.href) || p.test(link.text)),
      );
  });

  // Step 3: Crawl each subpage
  const subpageData: Partial<ApartmentData>[] = [];
  for (const link of subpageLinks.slice(0, 5)) {
    // Limit to 5 subpages
    try {
      await page.goto(link.href, { waitUntil: "networkidle", timeout: 15000 });
      const subHtml = await page.content();
      subpageData.push(extractFromHtml(subHtml));
    } catch {}
  }

  // Step 4: Also check for tab/accordion content on main page
  await page.goto(url, { waitUntil: "networkidle" });
  const tabs = await page.$$('[role="tab"], .tab-link, [data-toggle="tab"]');
  for (const tab of tabs) {
    await tab.click();
    await page.waitForTimeout(500);
  }
  const expandedHtml = await page.content();
  const expandedData = extractFromHtml(expandedHtml);

  // Step 5: Merge all data (main page fields take priority)
  return mergeApartmentData(mainData, expandedData, ...subpageData);
}

function mergeApartmentData(
  ...sources: Partial<ApartmentData>[]
): ApartmentData {
  const merged: any = {};
  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      if (!value) continue;
      if (Array.isArray(value)) {
        merged[key] = [...new Set([...(merged[key] || []), ...value])];
      } else if (!merged[key]) {
        merged[key] = value;
      }
    }
  }
  return merged as ApartmentData;
}
```

### Expected Impact

- **+40-60% more fields** (floor plans are almost always on a separate page/tab)
- **Image URLs**: gallery pages often have 20-50 images vs 1-3 on the main page
- **Amenities**: dedicated amenities pages list 30-50 items vs 5-10 on main
- **Virtual tours, pet policies, neighborhood info**: only available on subpages

### Dependencies

None. Uses existing Playwright.

---

## 7. API Interception via Playwright

### What It Is

Many modern apartment sites (especially React/Vue SPAs) load data via internal APIs (REST/GraphQL). Intercepting these API calls gives you pre-structured JSON data that's MORE COMPLETE and MORE ACCURATE than anything on the rendered page.

### Concrete Implementation

```typescript
async function interceptApartmentApis(
  page: playwright.Page,
  url: string,
): Promise<any[]> {
  const interceptedData: any[] = [];

  // Intercept API responses
  page.on("response", async (response) => {
    const url = response.url();
    const contentType = response.headers()["content-type"] || "";

    // Look for JSON API responses
    if (contentType.includes("json") && response.status() === 200) {
      const apiPatterns = [
        /api.*(?:listing|property|apartment|unit|floorplan)/i,
        /graphql/i,
        /\.json$/,
        /\/v\d+\//, // versioned APIs
      ];

      if (apiPatterns.some((p) => p.test(url))) {
        try {
          const json = await response.json();
          interceptedData.push({ url, data: json });
        } catch {}
      }
    }
  });

  await page.goto(url, { waitUntil: "networkidle" });

  // Trigger lazy-loaded data
  await autoScroll(page);

  // Click tabs to trigger more API calls
  const tabTriggers = await page.$$(
    '[role="tab"], .tab-trigger, [data-toggle]',
  );
  for (const trigger of tabTriggers) {
    await trigger.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  return interceptedData;
}

// Extract apartment data from intercepted API responses
function parseInterceptedApis(apiResponses: any[]): Partial<ApartmentData> {
  const result: Partial<ApartmentData> = {};

  for (const { data } of apiResponses) {
    // Recursively search for apartment-like objects
    const candidates = findApartmentObjects(data);
    for (const obj of candidates) {
      // Map API field names to our schema
      if (obj.floorplans || obj.floor_plans || obj.units) {
        result.floorPlans = (
          obj.floorplans ||
          obj.floor_plans ||
          obj.units
        ).map(normalizeFloorPlan);
      }
      if (obj.amenities)
        result.amenities = obj.amenities.map((a) => a.name || a);
      if (obj.latitude || obj.lat) result.latitude = obj.latitude || obj.lat;
      if (obj.longitude || obj.lng) result.longitude = obj.longitude || obj.lng;
      // ... map other fields
    }
  }

  return result;
}

function findApartmentObjects(obj: any, depth = 0): any[] {
  if (depth > 5 || !obj) return [];
  const results: any[] = [];

  if (typeof obj === "object" && !Array.isArray(obj)) {
    const keys = Object.keys(obj);
    const apartmentKeys = [
      "floorplans",
      "floor_plans",
      "units",
      "amenities",
      "latitude",
      "longitude",
      "address",
      "property_name",
    ];
    if (apartmentKeys.some((k) => keys.includes(k))) {
      results.push(obj);
    }
    for (const val of Object.values(obj)) {
      results.push(...findApartmentObjects(val, depth + 1));
    }
  } else if (Array.isArray(obj)) {
    for (const item of obj) {
      results.push(...findApartmentObjects(item, depth + 1));
    }
  }

  return results;
}
```

### Expected Impact

- **+50-80% more fields** on SPA sites (API responses often include internal IDs, exact availability dates, square footage ranges, deposit amounts, etc.)
- **Perfect accuracy**: structured JSON from the API, no parsing needed
- **Gets data invisible on the page**: internal IDs, exact unit counts, availability dates
- **Common on**: Apartments.com, Zillow, RentPath sites, most modern property management platforms

### Dependencies

None. Uses existing Playwright.

---

## 8. Confidence Scoring & Validation

### What It Is

Score each extracted field's reliability and flag low-confidence extractions for review or re-extraction. Combine multiple signals: CSS extraction confidence, LLM self-reported confidence, cross-validation between sources, and format validation.

### Concrete Implementation

```typescript
interface FieldConfidence {
  value: any;
  confidence: number; // 0-1
  source: "css" | "jsonld" | "api" | "llm" | "merged";
  validationPassed: boolean;
}

function scoreExtraction(
  cssData: Record<string, any>,
  jsonLdData: Record<string, any>,
  apiData: Record<string, any>,
  llmData: Record<string, any>,
): Record<string, FieldConfidence> {
  const result: Record<string, FieldConfidence> = {};
  const allSources = [
    { data: apiData, source: "api" as const, baseScore: 0.95 },
    { data: jsonLdData, source: "jsonld" as const, baseScore: 0.95 },
    { data: cssData, source: "css" as const, baseScore: 0.85 },
    { data: llmData, source: "llm" as const, baseScore: 0.7 },
  ];

  // Collect all field names
  const allFields = new Set<string>();
  allSources.forEach((s) =>
    Object.keys(s.data).forEach((k) => allFields.add(k)),
  );

  for (const field of allFields) {
    const values = allSources
      .filter((s) => s.data[field] != null)
      .map((s) => ({
        value: s.data[field],
        source: s.source,
        baseScore: s.baseScore,
      }));

    if (values.length === 0) continue;

    // Pick highest-confidence source
    const best = values.sort((a, b) => b.baseScore - a.baseScore)[0];

    // Boost confidence if multiple sources agree
    let confidence = best.baseScore;
    const agreeing = values.filter(
      (v) => JSON.stringify(v.value) === JSON.stringify(best.value),
    ).length;
    if (agreeing > 1)
      confidence = Math.min(1, confidence + 0.1 * (agreeing - 1));

    // Format validation
    const valid = validateField(field, best.value);
    if (!valid) confidence *= 0.5;

    result[field] = {
      value: best.value,
      confidence,
      source: best.source,
      validationPassed: valid,
    };
  }

  return result;
}

function validateField(field: string, value: any): boolean {
  const validators: Record<string, (v: any) => boolean> = {
    phone: (v) => /^\+?[\d\s\-().]{7,20}$/.test(String(v)),
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v)),
    zip: (v) => /^\d{5}(-\d{4})?$/.test(String(v)),
    latitude: (v) => !isNaN(v) && Math.abs(v) <= 90,
    longitude: (v) => !isNaN(v) && Math.abs(v) <= 180,
    yearBuilt: (v) => !isNaN(v) && v > 1900 && v <= new Date().getFullYear(),
    price: (v) => !isNaN(v) && v > 0 && v < 100000,
    sqft: (v) => !isNaN(v) && v > 50 && v < 50000,
  };
  return validators[field] ? validators[field](value) : true;
}
```

### Expected Impact

- **Quality improvement**: catch 10-20% of LLM hallucinations before they enter the database
- **Prioritize re-extraction**: low-confidence fields can be re-extracted with more targeted prompts
- **Source tracking**: know where each field came from for debugging

### Dependencies

None.

---

## 9. Self-Healing Selectors (Element Fingerprinting)

### What It Is

Store a fingerprint of each target element (tag, text content, surrounding context, attributes) and use fuzzy matching to relocate it when the HTML structure changes. Scrapling (Python) demonstrates this approach.

### Concrete Implementation

```typescript
interface ElementFingerprint {
  tag: string;
  classes: string[];
  text: string; // First 100 chars of text content
  parentTag: string;
  siblingTags: string[]; // Adjacent siblings' tags
  attributes: Record<string, string>;
  depth: number; // DOM depth from body
}

function fingerprintElement(
  $: cheerio.CheerioAPI,
  selector: string,
): ElementFingerprint | null {
  const el = $(selector).first();
  if (!el.length) return null;

  return {
    tag: el.prop("tagName")?.toLowerCase() || "",
    classes: (el.attr("class") || "").split(/\s+/).filter(Boolean),
    text: el.text().trim().substring(0, 100),
    parentTag: el.parent().prop("tagName")?.toLowerCase() || "",
    siblingTags: el
      .siblings()
      .map((_, s) => $(s).prop("tagName")?.toLowerCase())
      .get(),
    attributes: el[0].attribs || {},
    depth: el.parents().length,
  };
}

function findByFingerprint(
  $: cheerio.CheerioAPI,
  fp: ElementFingerprint,
): string | null {
  let bestMatch: { selector: string; score: number } | null = null;

  $(fp.tag).each((i, el) => {
    const candidate = $(el);
    let score = 0;

    // Tag match (always true since we filter by tag)
    score += 1;

    // Class overlap
    const classes = (candidate.attr("class") || "").split(/\s+/);
    const classOverlap = fp.classes.filter((c) => classes.includes(c)).length;
    score += classOverlap * 2;

    // Text similarity (first 100 chars)
    const text = candidate.text().trim().substring(0, 100);
    if (text === fp.text) score += 5;
    else if (text.includes(fp.text.substring(0, 30))) score += 2;

    // Parent tag match
    if (candidate.parent().prop("tagName")?.toLowerCase() === fp.parentTag)
      score += 2;

    // Depth proximity
    const depth = candidate.parents().length;
    score += Math.max(0, 3 - Math.abs(depth - fp.depth));

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { selector: `${fp.tag}:eq(${i})`, score };
    }
  });

  return bestMatch && bestMatch.score >= 5 ? bestMatch.selector : null;
}

// Usage: store fingerprints on first successful extraction,
// use them as fallback when primary selectors fail
class AdaptiveExtractor {
  private fingerprints: Map<string, ElementFingerprint> = new Map();

  async extract(
    html: string,
    field: string,
    primarySelector: string,
  ): Promise<string | null> {
    const $ = cheerio.load(html);

    // Try primary selector first
    const primary = $(primarySelector).first().text().trim();
    if (primary) {
      // Update fingerprint on success
      const fp = fingerprintElement($, primarySelector);
      if (fp) this.fingerprints.set(field, fp);
      return primary;
    }

    // Fallback: use fingerprint matching
    const fp = this.fingerprints.get(field);
    if (fp) {
      const fallbackSelector = findByFingerprint($, fp);
      if (fallbackSelector) {
        return $(fallbackSelector).first().text().trim() || null;
      }
    }

    return null;
  }
}
```

### Expected Impact

- **Reduces selector breakage by 60-80%** on sites that redesign frequently
- **Lower maintenance**: scrapers self-recover instead of failing silently
- Best for fields with stable text content (property name, address) rather than dynamic values

### Dependencies

None new. Pure Cheerio logic.

---

## 10. Schema-Constrained LLM Output (Zod Validation)

### What It Is

Define the expected output schema with Zod, validate LLM responses against it, and retry on validation failure. The `llm-scraper` library (TypeScript/Node.js) demonstrates this pattern with Playwright integration. Also see `instructor` (Python) for the same concept.

### Concrete Implementation

```typescript
import { z } from "zod";

const ApartmentSchema = z
  .object({
    name: z.string().describe("Property name"),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().length(2).optional(),
    zip: z
      .string()
      .regex(/^\d{5}/)
      .optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    floorPlans: z
      .array(
        z.object({
          type: z.string(),
          beds: z.number().min(0).max(10).optional(),
          baths: z.number().min(0).max(10).optional(),
          sqftMin: z.number().min(50).optional(),
          sqftMax: z.number().min(50).optional(),
          priceMin: z.number().min(0).optional(),
          priceMax: z.number().min(0).optional(),
          available: z.boolean().optional(),
        }),
      )
      .optional(),
    amenities: z.array(z.string()).optional(),
    petPolicy: z.string().optional(),
    yearBuilt: z.number().min(1900).max(2030).optional(),
    totalUnits: z.number().min(1).optional(),
    managementCompany: z.string().optional(),
    parkingInfo: z.string().optional(),
    utilitiesIncluded: z.array(z.string()).optional(),
    officeHours: z.string().optional(),
    moveInSpecials: z.string().optional(),
    applicationFee: z.number().optional(),
    deposit: z.number().optional(),
  })
  .strict();

type ApartmentData = z.infer<typeof ApartmentSchema>;

async function extractWithValidation(
  content: string,
  llmCall: (prompt: string) => Promise<string>,
  maxRetries = 2,
): Promise<ApartmentData | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const prompt =
      attempt === 0
        ? buildExtractionPrompt(content)
        : buildRetryPrompt(content, lastError);

    const response = await llmCall(prompt);

    try {
      const parsed = JSON.parse(response);
      const validated = ApartmentSchema.parse(parsed);
      return validated;
    } catch (e) {
      if (e instanceof z.ZodError) {
        lastError = e.errors
          .map((err) => `${err.path.join(".")}: ${err.message}`)
          .join("; ");
        console.warn(
          `Validation failed (attempt ${attempt + 1}): ${lastError}`,
        );
      }
    }
  }
  return null;
}
```

### Expected Impact

- **Eliminates malformed outputs** (invalid JSON, wrong types, out-of-range values)
- **Retry mechanism** recovers 50-70% of initially invalid extractions
- **Type safety** throughout the pipeline
- **Self-documenting schema** serves as both validation and documentation

### Dependencies

`zod` (lightweight, zero-dep, ~50KB).

---

## 11. Vision Model Fallback (Screenshots)

### What It Is

When HTML extraction fails or returns few fields, take a screenshot and send it to a vision-capable LLM for extraction. Works as a fallback layer, not primary extraction. Useful for canvas-rendered content, image-based pricing, or heavily obfuscated sites.

### Concrete Implementation

```typescript
async function visionFallback(
  page: playwright.Page,
  existingData: Partial<ApartmentData>,
  missingFields: string[],
): Promise<Partial<ApartmentData>> {
  if (missingFields.length < 3) return {}; // Not worth the cost for <3 fields

  // Take full-page screenshot
  const screenshot = await page.screenshot({
    fullPage: true,
    type: "png",
    // Limit height to avoid huge images
    clip: { x: 0, y: 0, width: 1280, height: 3000 },
  });

  const base64Image = screenshot.toString("base64");

  const prompt = `Look at this apartment listing screenshot.
I already have: ${JSON.stringify(existingData, null, 2)}
I'm missing these fields: ${missingFields.join(", ")}
Extract ONLY the missing fields from what you can see in the image.
Return JSON with only the fields you found.`;

  // Send to vision-capable model (same model, multimodal endpoint)
  const response = await callVisionLlm(prompt, base64Image);
  return JSON.parse(response);
}
```

### Expected Impact

- **+5-15% recovery** on fields missed by HTML extraction
- **Best for**: price sheets in images, infographics, canvas-rendered maps
- **Cost**: ~$0.01-0.05 per screenshot analysis (vision tokens are more expensive)
- **Not suitable** as primary extraction method (slow, expensive, hallucination-prone)

### Dependencies

None new if your LLM supports vision (most do now). Just Playwright screenshots.

---

## 12. Content Extraction Algorithms (Readability)

### What It Is

Use established content extraction algorithms (Readability, Trafilatura) to identify the "main content" of a page before sending to LLM. Mozilla's Readability.js (used in Firefox Reader View) achieves F1 ~0.92 for content identification.

### Concrete Implementation

```typescript
// Readability.js is available as @mozilla/readability (works in Node with jsdom)
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

function extractMainContent(
  html: string,
  url: string,
): {
  title: string;
  content: string;
  textContent: string;
  excerpt: string;
} | null {
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  return reader.parse();
}

// Use in pipeline:
// 1. Extract JSON-LD and CSS data first
// 2. Run Readability to get clean content
// 3. Send only Readability output to LLM for remaining fields
async function hybridExtraction(html: string, url: string) {
  const jsonLd = extractJsonLd(html);
  const cssData = extractBySchema(html, getSchemaForSite(url));

  // Get clean content for LLM
  const readable = extractMainContent(html, url);
  if (!readable) return { ...cssData, ...mapSchemaOrgToApartment(jsonLd) };

  // Only send readable content to LLM (much smaller than full HTML)
  const llmData = await extractWithLlm(readable.textContent);

  return mergeApartmentData(
    mapSchemaOrgToApartment(jsonLd), // Highest priority
    cssData,
    llmData,
  );
}
```

### Expected Impact

- **30-50% token reduction** vs sending full HTML to LLM
- **Better LLM accuracy** because noise is removed
- Readability.js: F1 0.92, zero config, battle-tested (Firefox uses it)
- Trafilatura (Python): F1 0.937, even better but requires Python

### Dependencies

`@mozilla/readability` + `jsdom` (both well-maintained, widely used).

---

## Recommended Implementation Order

### Phase 1 (Week 1): Highest Impact, Lowest Effort — P0

1. **JSON-LD/Schema.org harvesting** — add 10 lines of code, instant free fields
2. **HTML preprocessing** — strip boilerplate before LLM, cut tokens 60%
3. **Few-shot examples** — update prompt with 2-3 apartment examples
4. **Explicit field enumeration** — list all desired fields in prompt

### Phase 2 (Week 2): High Impact, Medium Effort — P1

5. **Schema-driven CSS extraction** — build per-site schemas for top 10 apartment sites
6. **API interception** — add response listener in Playwright, capture JSON APIs
7. **Zod validation** — define ApartmentSchema, validate + retry on failure
8. **Confidence scoring** — score fields by source, flag low-confidence

### Phase 3 (Week 3-4): Medium Impact, Higher Effort — P2

9. **Multi-level crawling** — crawl floor plans/amenities/gallery subpages
10. **Self-healing selectors** — element fingerprinting for top sites
11. **Readability integration** — use @mozilla/readability for content extraction

### Phase 4 (When Needed): Specialized — P3

12. **Vision fallback** — screenshot-based extraction for edge cases

---

## Expected Cumulative Impact

| Phase                            | Additional Fields | Cumulative | Quality Improvement       |
| -------------------------------- | ----------------- | ---------- | ------------------------- |
| Phase 1 (Prompt + JSON-LD)       | +35-50%           | +35-50%    | Fewer hallucinations      |
| Phase 2 (CSS + API + Validation) | +30-40%           | +65-80%    | Near-zero malformed data  |
| Phase 3 (Depth + Healing)        | +20-30%           | +85-100%   | Self-maintaining scrapers |
| Phase 4 (Vision)                 | +5-10%            | +90-110%   | Edge case recovery        |

---

## Sources

- [Crawl4AI LLM-Free Strategies](https://docs.crawl4ai.com/extraction/no-llm-strategies/)
- [Crawl4AI LLM Strategies](https://docs.crawl4ai.com/extraction/llm-strategies/)
- [LLM-Scraper (GitHub)](https://github.com/mishushakov/llm-scraper)
- [ScrapeGraphAI (GitHub)](https://github.com/ScrapeGraphAI/Scrapegraph-ai)
- [Instructor (GitHub)](https://github.com/567-labs/instructor)
- [Beyond BeautifulSoup: Benchmarking LLM-Powered Web Scraping](https://arxiv.org/html/2601.06301v1)
- [ScrapeGraphAI-100k Dataset](https://arxiv.org/html/2602.15189)
- [6 Best LLM Scrapers 2026](https://brightdata.com/blog/ai/best-llm-scrapers)
- [HTML Preprocessing for LLMs](https://dev.to/rosgluk/html-preprocessing-for-llms-3mk8)
- [ReaderLM-v2](https://arxiv.org/html/2503.01151v1)
- [Crawl4AI Markdown Generation](https://docs.crawl4ai.com/core/markdown-generation/)
- [HTML to Markdown Best Practices](https://www.searchcans.com/blog/html-to-markdown-llm-training-data-best-practices-2026/)
- [Firecrawl (GitHub)](https://github.com/firecrawl/firecrawl)
- [Scrapling: Adaptive Web Scraping](https://github.com/D4Vinci/Scrapling)
- [Self-Healing Web Scrapers with AI](https://joshhixson.com/how-to-create-self-healing-web-scrapers-with-artificial-intelligence/)
- [GPT-4 Vision for Multimodal Web Scraping](https://www.kadoa.com/blog/using-gpt-4-vision-for-multimodal-web-scraping)
- [Confidence Signals for LLM Extraction](https://www.sensible.so/blog/confidence-signals)
- [Trafilatura Evaluation](https://trafilatura.readthedocs.io/en/latest/evaluation.html)
- [Schema.org RealEstateListing](https://schema.org/RealEstateListing)
- [Real Estate Schema Markup Guide](https://www.seoclarity.net/blog/structured-data-for-real-estate-listings)
- [Structured Data Extraction with LangExtract](https://towardsdatascience.com/extracting-structured-data-with-langextract-a-deep-dive-into-llm-orchestrated-workflows/)
- [LLM Confidence Scoring](https://github.com/VATBox/llm-confidence)
- [Playwright Web Scraping 2026](https://www.scrapingdog.com/blog/playwright-web-scraping-nodejs/)
- [Handling Pagination 2026](https://brightdata.com/blog/web-data/pagination-web-scraping)

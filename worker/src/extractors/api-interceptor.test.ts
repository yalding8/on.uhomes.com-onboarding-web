import { describe, it, expect } from "vitest";
import { isApartmentData, mapApiResponse } from "./api-interceptor.js";

describe("isApartmentData", () => {
  it("should detect apartment pricing data", () => {
    const json = { units: [{ price: 1500, bedrooms: 1, name: "Studio" }] };
    expect(isApartmentData(JSON.stringify(json))).toBe(true);
  });

  it("should detect amenities data", () => {
    const json = {
      amenities: ["Gym", "Pool", "Parking"],
      buildingName: "Test Tower",
    };
    expect(isApartmentData(JSON.stringify(json))).toBe(true);
  });

  it("should reject analytics/config JSON", () => {
    const json = { gtm_id: "GTM-123", event: "page_view", userId: "abc" };
    expect(isApartmentData(JSON.stringify(json))).toBe(false);
  });

  it("should reject auth/session JSON", () => {
    const json = {
      access_token: "jwt...",
      refresh_token: "...",
      expires_in: 3600,
    };
    expect(isApartmentData(JSON.stringify(json))).toBe(false);
  });

  it("should reject small JSON payloads", () => {
    expect(isApartmentData('{"ok":true}')).toBe(false);
  });
});

describe("mapApiResponse", () => {
  it("should map flat apartment data", () => {
    const json = {
      name: "Test Tower",
      address: "123 Main St",
      city: "New York",
      minRent: 1500,
      maxRent: 3500,
      amenities: ["Gym", "Pool", "Laundry"],
    };
    const fields = mapApiResponse(json);
    expect(fields.building_name?.value).toBe("Test Tower");
    expect(fields.price_min?.value).toBe(1500);
    expect(fields.key_amenities?.value).toContain("Gym");
    expect(fields.building_name?.confidence).toBe("high");
  });

  it("should map nested unit/floorplan data", () => {
    const json = {
      property: {
        name: "Nested Tower",
        units: [
          { type: "Studio", rent: 1200 },
          { type: "1BR", rent: 1800 },
        ],
      },
    };
    const fields = mapApiResponse(json);
    expect(fields.building_name?.value).toBe("Nested Tower");
    expect(fields.unit_types_summary).toBeDefined();
  });

  it("should map GraphQL response with data wrapper", () => {
    const json = {
      data: {
        property: {
          name: "GraphQL Tower",
          address: "456 Oak Ave",
          amenities: [{ name: "Gym" }, { name: "Pool" }],
        },
      },
    };
    const fields = mapApiResponse(json);
    expect(fields.building_name?.value).toBe("GraphQL Tower");
  });

  it("should return empty for non-apartment data", () => {
    const json = { config: { theme: "dark" }, version: "1.0" };
    const fields = mapApiResponse(json);
    expect(Object.keys(fields).length).toBe(0);
  });

  it("should assign high confidence to all API fields", () => {
    const json = { name: "Test", city: "NYC", rent: 2000 };
    const fields = mapApiResponse(json);
    for (const field of Object.values(fields)) {
      expect(field.confidence).toBe("high");
    }
  });

  it("should map building detail fields (yearBuilt, floors, currency)", () => {
    const json = {
      propertyName: "Detail Tower",
      yearBuilt: 2019,
      floors: 12,
      currencyCode: "GBP",
    };
    const fields = mapApiResponse(json);
    expect(fields.building_name?.value).toBe("Detail Tower");
    expect(fields.year_built?.value).toBe(2019);
    expect(fields.number_of_floors?.value).toBe(12);
    expect(fields.currency?.value).toBe("GBP");
  });

  it("should map fee/policy fields (deposit, furnished, utilities)", () => {
    const json = {
      name: "Fee Tower",
      securityDeposit: 1500,
      furnished: "Fully Furnished",
      utilities: "Water, Gas, Internet included",
    };
    const fields = mapApiResponse(json);
    expect(fields.deposit_intl?.value).toBe(1500);
    expect(fields.furnished_options?.value).toBe("Fully Furnished");
    expect(fields.utilities_included?.value).toBe(
      "Water, Gas, Internet included",
    );
  });

  it("should detect daily price period from API key names", () => {
    const json = {
      name: "Daily Tower",
      dailyRate: 150,
      nightlyRate: 180,
    };
    const fields = mapApiResponse(json);
    expect(fields.price_min?.value).toBe(150);
    expect(fields.price_period?.value).toBe("daily");
  });

  it("should detect weekly price period from API key names", () => {
    const json = {
      name: "Weekly Tower",
      weeklyRate: 900,
    };
    const fields = mapApiResponse(json);
    expect(fields.price_min?.value).toBe(900);
    expect(fields.price_period?.value).toBe("weekly");
  });

  it("should default to monthly for rent/monthlyRent keys", () => {
    const json = {
      name: "Monthly Tower",
      monthlyRent: 2500,
    };
    const fields = mapApiResponse(json);
    expect(fields.price_min?.value).toBe(2500);
    expect(fields.price_period?.value).toBe("monthly");
  });

  it("should not set price_period when no price fields found", () => {
    const json = { name: "No Price Tower", city: "NYC" };
    const fields = mapApiResponse(json);
    expect(fields.price_period).toBeUndefined();
  });

  it("should map Guesty booking API response", () => {
    const json = {
      platform: "GUESTY",
      title: "CN Views at the Nobu",
      address: {
        full: "15 Mercer St, Toronto, ON M5V 1H2, Canada",
        street: "Mercer Street 15",
        city: "Toronto",
        country: "Canada",
        zipcode: "M5V 1H2",
      },
      prices: {
        basePrice: 170,
        currency: "CAD",
        cleaningFee: 200,
      },
      terms: {
        minNights: 31,
        maxNights: 730,
      },
      bedrooms: 2,
      bathrooms: 2,
      areaSquareFeet: 750,
      propertyType: "Condominium",
      amenities: ["Gym", "Elevator", "Washer", "Dryer"],
    };
    const fields = mapApiResponse(json);
    expect(fields.building_name?.value).toBe("CN Views at the Nobu");
    expect(fields.building_address?.value).toBe("Mercer Street 15");
    expect(fields.city?.value).toBe("Toronto");
    expect(fields.postal_code?.value).toBe("M5V 1H2");
    expect(fields.price_min?.value).toBe(170);
    expect(fields.currency?.value).toBe("CAD");
    // basePrice in Guesty is a nightly rate → price_period should be daily
    expect(fields.price_period?.value).toBe("daily");
  });

  it("should map floor plan keys to floor_plans", () => {
    const json = {
      name: "Plan Tower",
      floorPlans: [
        { name: "Studio", sqft: 450 },
        { name: "1BR", sqft: 650 },
      ],
    };
    const fields = mapApiResponse(json);
    expect(fields.building_name?.value).toBe("Plan Tower");
    // floorPlans array → unit_types_summary via extractUnitTypes
    expect(fields.unit_types_summary?.value).toContain("Studio");
  });
});

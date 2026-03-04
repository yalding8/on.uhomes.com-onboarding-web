import { describe, it, expect } from "vitest";
import {
  assignBD,
  type ApplicationInput,
  type BDTerritory,
} from "../bd-assignment";

const TERRITORIES: BDTerritory[] = [
  {
    bd_user_id: "bd_toronto",
    country_code: "CA",
    city: "Toronto",
    active_count: 5,
    is_active: true,
    priority: 0,
    referral_code: null,
  },
  {
    bd_user_id: "bd_ca_1",
    country_code: "CA",
    city: null,
    active_count: 10,
    is_active: true,
    priority: 0,
    referral_code: null,
  },
  {
    bd_user_id: "bd_ca_2",
    country_code: "CA",
    city: null,
    active_count: 3,
    is_active: true,
    priority: 0,
    referral_code: null,
  },
  {
    bd_user_id: "bd_au",
    country_code: "AU",
    city: null,
    active_count: 8,
    is_active: true,
    priority: 0,
    referral_code: null,
  },
  {
    bd_user_id: "bd_global_1",
    country_code: null,
    city: null,
    active_count: 20,
    is_active: true,
    priority: 0,
    referral_code: null,
  },
  {
    bd_user_id: "bd_global_2",
    country_code: null,
    city: null,
    active_count: 2,
    is_active: true,
    priority: 0,
    referral_code: null,
  },
  {
    bd_user_id: "bd_ref_001",
    country_code: "US",
    city: null,
    active_count: 15,
    is_active: true,
    priority: 0,
    referral_code: "REF001",
  },
  {
    bd_user_id: "bd_paused",
    country_code: "CA",
    city: "Vancouver",
    active_count: 0,
    is_active: false,
    priority: -1,
    referral_code: null,
  },
];

// S4-U01: BD auto-assignment with referral code
describe("assignBD", () => {
  it("S4-U01: assigns to BD with matching referral code", () => {
    const input: ApplicationInput = {
      referral_code: "REF001",
      city: "New York",
      country_code: "US",
    };
    const result = assignBD(input, TERRITORIES);
    expect(result?.bd_user_id).toBe("bd_ref_001");
    expect(result?.reason).toBe("referral");
  });

  // S4-U02: BD auto-assignment with city match
  it("S4-U02: assigns to city-specific BD", () => {
    const input: ApplicationInput = {
      referral_code: null,
      city: "Toronto",
      country_code: "CA",
    };
    const result = assignBD(input, TERRITORIES);
    expect(result?.bd_user_id).toBe("bd_toronto");
    expect(result?.reason).toBe("city");
  });

  // S4-U03: BD auto-assignment with country fallback (lowest load)
  it("S4-U03: falls back to lowest-load country BD", () => {
    const input: ApplicationInput = {
      referral_code: null,
      city: "Vancouver",
      country_code: "CA",
    };
    const result = assignBD(input, TERRITORIES);
    // bd_ca_2 has active_count 3 (lowest among CA country BDs)
    expect(result?.bd_user_id).toBe("bd_ca_2");
    expect(result?.reason).toBe("country");
  });

  // S4-U04: BD auto-assignment with global fallback
  it("S4-U04: falls back to globally lowest-load BD", () => {
    const input: ApplicationInput = {
      referral_code: null,
      city: "Unknown",
      country_code: "XX",
    };
    const result = assignBD(input, TERRITORIES);
    // bd_global_2 has active_count 2 (lowest among global BDs)
    expect(result?.bd_user_id).toBe("bd_global_2");
    expect(result?.reason).toBe("global");
  });

  it("skips inactive/paused BDs", () => {
    const input: ApplicationInput = {
      referral_code: null,
      city: "Vancouver",
      country_code: "CA",
    };
    const result = assignBD(input, TERRITORIES);
    // bd_paused has Vancouver but is_active=false → should not be assigned
    expect(result?.bd_user_id).not.toBe("bd_paused");
  });

  it("returns null when no territories available", () => {
    const result = assignBD(
      { referral_code: null, city: "Mars", country_code: "ZZ" },
      [],
    );
    expect(result).toBeNull();
  });

  it("ignores referral code case sensitivity", () => {
    const input: ApplicationInput = {
      referral_code: "ref001",
      city: "Anywhere",
      country_code: "US",
    };
    const result = assignBD(input, TERRITORIES);
    expect(result?.bd_user_id).toBe("bd_ref_001");
  });

  it("prefers referral over city match", () => {
    const input: ApplicationInput = {
      referral_code: "REF001",
      city: "Toronto",
      country_code: "CA",
    };
    const result = assignBD(input, TERRITORIES);
    // Should pick referral BD, not Toronto city BD
    expect(result?.bd_user_id).toBe("bd_ref_001");
    expect(result?.reason).toBe("referral");
  });
});

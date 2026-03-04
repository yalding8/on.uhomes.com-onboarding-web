/**
 * S3.1 Cookie Consent — Unit Tests
 * Covers consent state management, country-based defaults, persistence.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  getDefaultConsent,
  readConsent,
  saveConsent,
  shouldShowBanner,
  acceptAll,
  rejectOptional,
} from "../cookie-consent";

describe("getDefaultConsent", () => {
  it("returns analytics OFF for EU country (DE)", () => {
    const consent = getDefaultConsent("DE");
    expect(consent.necessary).toBe(true);
    expect(consent.functional).toBe(false);
    expect(consent.analytics).toBe(false);
  });

  it("returns analytics OFF for UK (GB)", () => {
    const consent = getDefaultConsent("GB");
    expect(consent.analytics).toBe(false);
    expect(consent.functional).toBe(false);
  });

  it("returns functional ON for non-EU country (AU)", () => {
    const consent = getDefaultConsent("AU");
    expect(consent.necessary).toBe(true);
    expect(consent.functional).toBe(true);
    expect(consent.analytics).toBe(false);
  });

  it("returns functional ON for US", () => {
    const consent = getDefaultConsent("US");
    expect(consent.functional).toBe(true);
    expect(consent.analytics).toBe(false);
  });

  it("necessary is always true", () => {
    expect(getDefaultConsent("DE").necessary).toBe(true);
    expect(getDefaultConsent("US").necessary).toBe(true);
    expect(getDefaultConsent().necessary).toBe(true);
  });

  it("analytics always defaults OFF regardless of country", () => {
    expect(getDefaultConsent("AU").analytics).toBe(false);
    expect(getDefaultConsent("US").analytics).toBe(false);
    expect(getDefaultConsent("JP").analytics).toBe(false);
  });
});

describe("localStorage persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shouldShowBanner returns true on first visit", () => {
    expect(shouldShowBanner()).toBe(true);
  });

  it("shouldShowBanner returns false after saving consent", () => {
    saveConsent({ necessary: true, functional: true, analytics: false });
    expect(shouldShowBanner()).toBe(false);
  });

  it("readConsent returns saved state", () => {
    const state = { necessary: true, functional: true, analytics: true };
    saveConsent(state);
    const result = readConsent();
    expect(result).toEqual(state);
  });

  it("readConsent always forces necessary=true", () => {
    localStorage.setItem(
      "cookie_consent",
      JSON.stringify({
        necessary: false,
        functional: true,
        analytics: false,
      }),
    );
    const result = readConsent();
    expect(result?.necessary).toBe(true);
  });
});

describe("acceptAll", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("sets all categories to true", () => {
    const result = acceptAll();
    expect(result).toEqual({
      necessary: true,
      functional: true,
      analytics: true,
    });
  });

  it("persists to localStorage", () => {
    acceptAll();
    expect(readConsent()?.analytics).toBe(true);
  });
});

describe("rejectOptional", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps only necessary cookies", () => {
    const result = rejectOptional();
    expect(result).toEqual({
      necessary: true,
      functional: false,
      analytics: false,
    });
  });
});

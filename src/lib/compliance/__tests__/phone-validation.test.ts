/**
 * S3.3 Phone Validation — Unit Tests
 * Test IDs: S3-U01, S3-U02, S3-U03, S3-U04
 */
import { describe, it, expect } from "vitest";
import { validatePhone } from "../phone-validation";

describe("validatePhone", () => {
  // S3-U01: Australian number
  it("validates Australian mobile number", () => {
    const result = validatePhone("+61 4 1234 5678");
    expect(result.valid).toBe(true);
    expect(result.countryCode).toBe("AU");
    expect(result.e164).toBe("+61412345678");
    expect(result.formatted).toContain("+61");
  });

  // S3-U02: Canadian number
  it("validates Canadian number", () => {
    const result = validatePhone("+1 (647) 493-7470");
    expect(result.valid).toBe(true);
    expect(result.countryCode).toBe("CA");
    expect(result.e164).toBe("+16474937470");
  });

  // S3-U03: Invalid number
  it("rejects invalid number", () => {
    const result = validatePhone("12345");
    expect(result.valid).toBe(false);
    expect(result.e164).toBeNull();
    expect(result.countryCode).toBeNull();
  });

  // S3-U04: Hong Kong number
  it("validates Hong Kong number", () => {
    const result = validatePhone("+852 9123 4567");
    expect(result.valid).toBe(true);
    expect(result.countryCode).toBe("HK");
    expect(result.e164).toBe("+85291234567");
  });

  it("validates UK number", () => {
    const result = validatePhone("+44 20 7946 0958");
    expect(result.valid).toBe(true);
    expect(result.countryCode).toBe("GB");
  });

  it("validates US number with default country", () => {
    const result = validatePhone("(212) 555-1234", "US");
    expect(result.valid).toBe(true);
    expect(result.countryCode).toBe("US");
    expect(result.e164).toBe("+12125551234");
  });

  it("returns invalid for empty string", () => {
    const result = validatePhone("");
    expect(result.valid).toBe(false);
  });

  it("returns invalid for whitespace only", () => {
    const result = validatePhone("   ");
    expect(result.valid).toBe(false);
  });

  it("validates German number", () => {
    const result = validatePhone("+49 170 1234567");
    expect(result.valid).toBe(true);
    expect(result.countryCode).toBe("DE");
  });

  it("validates Japanese number", () => {
    const result = validatePhone("+81 90 1234 5678");
    expect(result.valid).toBe(true);
    expect(result.countryCode).toBe("JP");
  });

  it("validates Singapore number", () => {
    const result = validatePhone("+65 9123 4567");
    expect(result.valid).toBe(true);
    expect(result.countryCode).toBe("SG");
  });

  it("validates New Zealand number", () => {
    const result = validatePhone("+64 21 123 4567");
    expect(result.valid).toBe(true);
    expect(result.countryCode).toBe("NZ");
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for admin permission helpers.
 *
 * Because ADMIN_EMAILS is computed at module load time from process.env,
 * we need to manipulate env vars BEFORE each dynamic import and reset
 * the module cache between tests.
 */

describe("permissions — default admin emails (no env var)", () => {
  beforeEach(() => {
    delete process.env.ADMIN_EMAILS;
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("isAdmin returns true for default admin emails", async () => {
    const { isAdmin } = await import("../permissions");
    expect(isAdmin("ning.ding@uhomes.com")).toBe(true);
    expect(isAdmin("abby.zhang@uhomes.com")).toBe(true);
    expect(isAdmin("lei.tian@uhomes.com")).toBe(true);
    expect(isAdmin("lifan.wen@uhomes.com")).toBe(true);
  });

  it("isAdmin is case-insensitive", async () => {
    const { isAdmin } = await import("../permissions");
    expect(isAdmin("Ning.Ding@uhomes.com")).toBe(true);
    expect(isAdmin("ABBY.ZHANG@UHOMES.COM")).toBe(true);
  });

  it("isAdmin returns false for non-admin emails", async () => {
    const { isAdmin } = await import("../permissions");
    expect(isAdmin("random@example.com")).toBe(false);
    expect(isAdmin("")).toBe(false);
  });

  it("ADMIN_EMAILS contains the four default admins", async () => {
    const { ADMIN_EMAILS } = await import("../permissions");
    expect(ADMIN_EMAILS).toHaveLength(4);
    expect(ADMIN_EMAILS).toContain("ning.ding@uhomes.com");
    expect(ADMIN_EMAILS).toContain("abby.zhang@uhomes.com");
    expect(ADMIN_EMAILS).toContain("lei.tian@uhomes.com");
    expect(ADMIN_EMAILS).toContain("lifan.wen@uhomes.com");
  });
});

describe("permissions — ADMIN_EMAILS env var override", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.ADMIN_EMAILS;
    vi.restoreAllMocks();
  });

  it("reads admin emails from ADMIN_EMAILS env var", async () => {
    process.env.ADMIN_EMAILS = "custom@example.com,other@example.com";
    const { ADMIN_EMAILS, isAdmin } = await import("../permissions");
    expect(ADMIN_EMAILS).toHaveLength(2);
    expect(isAdmin("custom@example.com")).toBe(true);
    expect(isAdmin("other@example.com")).toBe(true);
    expect(isAdmin("ning.ding@uhomes.com")).toBe(false);
  });

  it("trims whitespace and lowercases env var entries", async () => {
    process.env.ADMIN_EMAILS = " Alice@Example.COM , bob@test.com ";
    const { ADMIN_EMAILS, isAdmin } = await import("../permissions");
    expect(ADMIN_EMAILS).toEqual(["alice@example.com", "bob@test.com"]);
    expect(isAdmin("Alice@Example.COM")).toBe(true);
  });

  it("filters out empty entries from env var", async () => {
    process.env.ADMIN_EMAILS = "a@b.com,,, ,c@d.com";
    const { ADMIN_EMAILS } = await import("../permissions");
    expect(ADMIN_EMAILS).toEqual(["a@b.com", "c@d.com"]);
  });

  it("falls back to defaults when env var is empty string", async () => {
    process.env.ADMIN_EMAILS = "";
    const { ADMIN_EMAILS } = await import("../permissions");
    expect(ADMIN_EMAILS).toHaveLength(4);
  });

  it("falls back to defaults when env var is only whitespace", async () => {
    process.env.ADMIN_EMAILS = "   ";
    const { ADMIN_EMAILS } = await import("../permissions");
    expect(ADMIN_EMAILS).toHaveLength(4);
  });
});

describe("isBdDomain", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns true for @uhomes.com emails", async () => {
    const { isBdDomain } = await import("../permissions");
    expect(isBdDomain("alice@uhomes.com")).toBe(true);
    expect(isBdDomain("bob.smith@uhomes.com")).toBe(true);
  });

  it("is case-insensitive", async () => {
    const { isBdDomain } = await import("../permissions");
    expect(isBdDomain("ALICE@UHOMES.COM")).toBe(true);
    expect(isBdDomain("Alice@Uhomes.Com")).toBe(true);
  });

  it("returns false for external emails", async () => {
    const { isBdDomain } = await import("../permissions");
    expect(isBdDomain("user@gmail.com")).toBe(false);
    expect(isBdDomain("user@outlook.com")).toBe(false);
  });

  it("returns false for similar but different domains", async () => {
    const { isBdDomain } = await import("../permissions");
    expect(isBdDomain("user@notuhomes.com")).toBe(false);
    expect(isBdDomain("user@uhomes.com.cn")).toBe(false);
    expect(isBdDomain("user@sub.uhomes.com")).toBe(false);
  });
});

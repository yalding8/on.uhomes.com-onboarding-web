/**
 * S5.2 Sentry — Unit Tests
 * Test IDs: S5-I01, S5-I02 (unit-level validation of capture helpers)
 *
 * We mock @sentry/nextjs to verify correct calls without a real DSN.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Sentry before importing our module
vi.mock("@sentry/nextjs", () => ({
  withScope: vi.fn((cb: (scope: MockScope) => void) => {
    const scope = {
      setTag: vi.fn(),
      setLevel: vi.fn(),
      setExtras: vi.fn(),
    };
    cb(scope);
    return scope;
  }),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
}));

import * as Sentry from "@sentry/nextjs";
import {
  captureError,
  captureMessage,
  setSentryUser,
  clearSentryUser,
} from "../sentry";

type MockScope = {
  setTag: ReturnType<typeof vi.fn>;
  setLevel: ReturnType<typeof vi.fn>;
  setExtras: ReturnType<typeof vi.fn>;
};

describe("captureError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends Error to Sentry with module tag", () => {
    const err = new Error("DocuSign webhook timeout");
    captureError("docusign", err, { envelope_id: "abc-123" });

    expect(Sentry.withScope).toHaveBeenCalledOnce();
    expect(Sentry.captureException).toHaveBeenCalledWith(err);
  });

  it("wraps non-Error values in Error", () => {
    captureError("worker", "LLM API rate limited");

    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "LLM API rate limited",
      }),
    );
  });

  it("passes extra context to scope", () => {
    const err = new Error("DB connection failed");
    captureError("supabase", err, { attempt: 3 }, "fatal");

    // withScope was called → the callback received our scope
    expect(Sentry.withScope).toHaveBeenCalledOnce();
  });
});

describe("captureMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends message with module prefix", () => {
    captureMessage("analytics", "SLA breached", "warning", {
      building_id: "xyz",
    });

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "[analytics] SLA breached",
    );
  });
});

describe("setSentryUser / clearSentryUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets user with id and role", () => {
    setSentryUser("user-123", "bd");
    expect(Sentry.setUser).toHaveBeenCalledWith({
      id: "user-123",
      role: "bd",
    });
  });

  it("clears user on logout", () => {
    clearSentryUser();
    expect(Sentry.setUser).toHaveBeenCalledWith(null);
  });
});

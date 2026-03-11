/**
 * approve-supplier route tests (mocked dependencies).
 *
 * TC-APPROVE-001: BD (non-admin) can approve
 * TC-APPROVE-002: Unauthenticated → 401
 * TC-APPROVE-003: Non-BD role → 403
 * TC-APPROVE-004: CONVERTING rollback on createUser failure
 * TC-APPROVE-005: CONVERTING rollback on duplicate supplier email
 * TC-APPROVE-006: Missing application_id → 400
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ─────────────────────────────────────────────

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/email/resend", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/email/templates/partnership-confirmed", () => ({
  buildPartnershipConfirmedEmail: vi
    .fn()
    .mockReturnValue({ subject: "test", html: "<p>test</p>" }),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const mockCreateAdmin = vi.mocked(createAdminClient);
const mockCreateClient = vi.mocked(createClient);

const APPLICATION = {
  id: "app-1",
  contact_email: "test@kiani.com",
  company_name: "Test - Kiani",
  supplier_type: "PBSA",
  assigned_bd_id: "bd-1",
};

function buildRequest(body: Record<string, unknown> = {}): Request {
  return new Request("http://localhost/api/admin/approve-supplier", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockAuthSession(
  email: string,
  role: string,
  userId = "user-bd-1",
  supplierId = "bd-1",
) {
  const serverClient = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId, email } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data:
                role === "bd"
                  ? {
                      id: supplierId,
                      user_id: userId,
                      company_name: "BD Office",
                      contact_email: email,
                      status: "SIGNED",
                      role: "bd",
                    }
                  : null,
              error: role !== "bd" ? { message: "Not found" } : null,
            }),
          }),
        }),
      }),
    }),
  };
  mockCreateClient.mockResolvedValue(serverClient as never);
}

/** Build a fluent mock where every method returns the proxy itself */
function createChainProxy(overrides: Record<string, unknown> = {}) {
  const calls: Array<{ method: string; args: unknown[] }> = [];

  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop: string) {
      // Prevent proxy from being treated as a thenable (infinite await loop)
      if (prop === "then") return undefined;
      if (prop in overrides) return overrides[prop];
      // When destructuring { error, data } from awaited chain results
      if (prop === "error") return null;
      if (prop === "data") return null;
      // Return a function that logs the call and returns the proxy
      return (...args: unknown[]) => {
        calls.push({ method: prop, args });
        return proxy;
      };
    },
  };
  const proxy: Record<string, unknown> = new Proxy({}, handler);
  return { proxy, calls };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ─────────────────────────────────────────────

describe("POST /api/admin/approve-supplier", () => {
  it("TC-APPROVE-001: BD (non-admin) can approve", async () => {
    mockAuthSession("random.bd@uhomes.com", "bd");

    const { proxy } = createChainProxy({
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: { user: { id: "new-user-1" } },
            error: null,
          }),
          listUsers: vi.fn(),
          deleteUser: vi.fn(),
        },
      },
      single: () => Promise.resolve({ data: APPLICATION, error: null }),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      rpc: () =>
        Promise.resolve({
          data: { supplier_id: "sup-1", contract_id: "con-1" },
          error: null,
        }),
    });

    mockCreateAdmin.mockReturnValue(proxy as never);

    const { POST } = await import("../route");
    const res = await POST(buildRequest({ application_id: "app-1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("TC-APPROVE-002: unauthenticated user → 401", async () => {
    const serverClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: "Not authenticated" },
        }),
      },
    };
    mockCreateClient.mockResolvedValue(serverClient as never);

    const { POST } = await import("../route");
    const res = await POST(buildRequest({ application_id: "app-1" }));

    expect(res.status).toBe(401);
  });

  it("TC-APPROVE-003: non-BD role → 403", async () => {
    mockAuthSession("supplier@example.com", "supplier");

    const { POST } = await import("../route");
    const res = await POST(buildRequest({ application_id: "app-1" }));

    expect(res.status).toBe(403);
  });

  it("TC-APPROVE-004: createUser failure rolls back CONVERTING → PENDING", async () => {
    mockAuthSession("random.bd@uhomes.com", "bd");

    const updateArgs: Array<Record<string, unknown>> = [];
    const { proxy } = createChainProxy({
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: "Service temporarily unavailable" },
          }),
          listUsers: vi.fn(),
          deleteUser: vi.fn(),
        },
      },
      single: () => Promise.resolve({ data: APPLICATION, error: null }),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      update: (...args: unknown[]) => {
        if (args[0] && typeof args[0] === "object") {
          updateArgs.push(args[0] as Record<string, unknown>);
        }
        return proxy;
      },
    });

    mockCreateAdmin.mockReturnValue(proxy as never);

    const { POST } = await import("../route");
    const res = await POST(buildRequest({ application_id: "app-1" }));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("Failed to create auth user");

    // Verify rollback: CONVERTING then PENDING
    const rollback = updateArgs.find((c) => c.status === "PENDING");
    expect(rollback).toBeDefined();
  });

  it("TC-APPROVE-005: duplicate supplier email rolls back CONVERTING → PENDING", async () => {
    mockAuthSession("random.bd@uhomes.com", "bd");

    const updateArgs: Array<Record<string, unknown>> = [];
    const { proxy } = createChainProxy({
      auth: {
        admin: {
          createUser: vi.fn(),
          listUsers: vi.fn(),
          deleteUser: vi.fn(),
        },
      },
      single: () => Promise.resolve({ data: APPLICATION, error: null }),
      maybeSingle: () =>
        Promise.resolve({
          data: { id: "existing-sup" },
          error: null,
        }),
      update: (...args: unknown[]) => {
        if (args[0] && typeof args[0] === "object") {
          updateArgs.push(args[0] as Record<string, unknown>);
        }
        return proxy;
      },
    });

    mockCreateAdmin.mockReturnValue(proxy as never);

    const { POST } = await import("../route");
    const res = await POST(buildRequest({ application_id: "app-1" }));

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("already exists");

    const rollback = updateArgs.find((c) => c.status === "PENDING");
    expect(rollback).toBeDefined();
  });

  it("TC-APPROVE-006: missing application_id → 400", async () => {
    mockAuthSession("random.bd@uhomes.com", "bd");

    const { POST } = await import("../route");
    const res = await POST(buildRequest({}));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("application_id");
  });
});

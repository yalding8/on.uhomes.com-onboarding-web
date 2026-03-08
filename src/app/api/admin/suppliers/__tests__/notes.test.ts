/**
 * Supplier Notes API unit tests
 *
 * Tests for GET/POST /api/admin/suppliers/[supplierId]/notes
 *
 * TC-NOTES-API-001: GET empty list -> 200 + empty array
 * TC-NOTES-API-002: POST add note -> 201 + note object
 * TC-NOTES-API-003: POST empty content -> 400
 * TC-NOTES-API-009: Unauthenticated -> 401
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import type { BdAuthResult } from "@/lib/admin/auth";

// ─── Mock: @/lib/admin/auth ─────────────────────────────────
const mockVerifyBdRole = vi.fn();
vi.mock("@/lib/admin/auth", () => ({
  verifyBdRole: () => mockVerifyBdRole(),
  isBdAuthError: (result: BdAuthResult | Response): result is Response =>
    result instanceof Response,
}));

// ─── Mock: @/lib/supabase/admin ─────────────────────────────
const mockFrom = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

// ─── Import route handlers (after mocks) ────────────────────
import { GET, POST } from "../[supplierId]/notes/route";

// ─── Fixtures ───────────────────────────────────────────────
const BD_SUPPLIER = {
  id: "bd-001",
  user_id: "user-001",
  company_name: "BD Corp",
  contact_email: "bd@example.com",
  status: "PENDING_CONTRACT",
  role: "bd",
};

const AUTH_SUCCESS: BdAuthResult = {
  user: { id: "user-001", email: "bd@example.com" } as BdAuthResult["user"],
  supplier: BD_SUPPLIER,
  isAdmin: true,
};

const SUPPLIER_ID = "supplier-123";

function makeContext(supplierId: string = SUPPLIER_ID) {
  return { params: Promise.resolve({ supplierId }) };
}

function makeRequest(body?: Record<string, unknown>): Request {
  return new Request("http://localhost/api/admin/suppliers/s/notes", {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** Helper: build a Supabase query chain mock */
function mockSupabaseChain(overrides: Record<string, unknown> = {}) {
  const defaults = {
    select: undefined as unknown,
    eq: undefined as unknown,
    single: undefined as unknown,
    order: undefined as unknown,
    insert: undefined as unknown,
  };
  const chain = { ...defaults, ...overrides };
  // Each method returns the chain unless overridden
  chain.select = chain.select ?? vi.fn().mockReturnValue(chain);
  chain.eq = chain.eq ?? vi.fn().mockReturnValue(chain);
  chain.single = chain.single ?? vi.fn().mockReturnValue(chain);
  chain.order = chain.order ?? vi.fn().mockReturnValue(chain);
  chain.insert = chain.insert ?? vi.fn().mockReturnValue(chain);
  return chain;
}

// ═════════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════════

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TC-NOTES-API-009: Unauthenticated -> 401", () => {
  it("GET returns 401 when not authenticated", async () => {
    mockVerifyBdRole.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("POST returns 401 when not authenticated", async () => {
    mockVerifyBdRole.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await POST(makeRequest({ content: "hello" }), makeContext());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });
});

describe("TC-NOTES-API-001: GET empty list -> 200 + empty array", () => {
  it("returns 200 with empty notes array", async () => {
    mockVerifyBdRole.mockResolvedValue(AUTH_SUCCESS);

    // First call: checkAccess -> suppliers table
    const accessChain = mockSupabaseChain({
      single: vi.fn().mockResolvedValue({
        data: { id: SUPPLIER_ID, bd_user_id: "bd-001" },
        error: null,
      }),
    });

    // Second call: fetch notes -> supplier_notes table
    const notesChain = mockSupabaseChain({
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    mockFrom
      .mockReturnValueOnce(accessChain) // checkAccess
      .mockReturnValueOnce(notesChain); // fetch notes

    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notes).toEqual([]);
  });
});

describe("TC-NOTES-API-002: POST add note -> 201 + note object", () => {
  it("returns 201 with the created note", async () => {
    mockVerifyBdRole.mockResolvedValue(AUTH_SUCCESS);

    const createdNote = {
      id: "note-1",
      author_email: "bd@example.com",
      content: "Test note content",
      created_at: "2026-03-08T00:00:00Z",
    };

    // checkAccess chain
    const accessChain = mockSupabaseChain({
      single: vi.fn().mockResolvedValue({
        data: { id: SUPPLIER_ID, bd_user_id: "bd-001" },
        error: null,
      }),
    });

    // insert chain: insert -> select -> single
    const insertChain = mockSupabaseChain({
      single: vi.fn().mockResolvedValue({ data: createdNote, error: null }),
    });

    mockFrom
      .mockReturnValueOnce(accessChain) // checkAccess
      .mockReturnValueOnce(insertChain); // insert note

    const res = await POST(
      makeRequest({ content: "Test note content" }),
      makeContext(),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.note).toEqual(createdNote);
  });
});

describe("TC-NOTES-API-003: POST empty content -> 400", () => {
  it("returns 400 when content is empty string", async () => {
    mockVerifyBdRole.mockResolvedValue(AUTH_SUCCESS);

    const accessChain = mockSupabaseChain({
      single: vi.fn().mockResolvedValue({
        data: { id: SUPPLIER_ID, bd_user_id: "bd-001" },
        error: null,
      }),
    });
    mockFrom.mockReturnValueOnce(accessChain);

    const res = await POST(makeRequest({ content: "" }), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 when content is whitespace only", async () => {
    mockVerifyBdRole.mockResolvedValue(AUTH_SUCCESS);

    const accessChain = mockSupabaseChain({
      single: vi.fn().mockResolvedValue({
        data: { id: SUPPLIER_ID, bd_user_id: "bd-001" },
        error: null,
      }),
    });
    mockFrom.mockReturnValueOnce(accessChain);

    const res = await POST(makeRequest({ content: "   " }), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 when content field is missing", async () => {
    mockVerifyBdRole.mockResolvedValue(AUTH_SUCCESS);

    const accessChain = mockSupabaseChain({
      single: vi.fn().mockResolvedValue({
        data: { id: SUPPLIER_ID, bd_user_id: "bd-001" },
        error: null,
      }),
    });
    mockFrom.mockReturnValueOnce(accessChain);

    const res = await POST(makeRequest({}), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

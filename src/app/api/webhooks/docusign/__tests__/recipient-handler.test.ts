/**
 * DocuSign recipient-completed handler tests (mocked dependencies).
 *
 * TC-DOCUSIGN-002: Non-supplier recipient → ignored
 * TC-DOCUSIGN-003: Idempotent when supplier_signed_at exists
 * TC-DOCUSIGN-010: Supplier update failure → 500 (triggers DocuSign retry)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────

function createMockChain(returnValue: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {};
  const methods = ["from", "select", "update", "eq", "single"];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue(returnValue);
  (chain.eq as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/docusign/client", () => ({
  downloadSignedDocument: vi.fn().mockRejectedValue(new Error("mock")),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { handleRecipientCompleted } from "../recipient-handler";

const mockCreateAdmin = vi.mocked(createAdminClient);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ──────────────────────────────────────────────

describe("handleRecipientCompleted", () => {
  it("TC-DOCUSIGN-002: ignores non-supplier recipient (routingOrder != 1)", async () => {
    const event = {
      data: {
        recipientEvents: [
          { routingOrder: "2", status: "completed", email: "abby@uhomes.com" },
        ],
      },
    };

    const res = await handleRecipientCompleted("env-123", event);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toBe("Non-supplier recipient");
    expect(mockCreateAdmin).not.toHaveBeenCalled();
  });

  it("TC-DOCUSIGN-002: ignores empty recipients array", async () => {
    const event = { data: { recipientEvents: [] } };

    const res = await handleRecipientCompleted("env-123", event);
    const body = await res.json();

    expect(body.message).toBe("Non-supplier recipient");
  });

  it("TC-DOCUSIGN-003: idempotent when supplier_signed_at exists", async () => {
    const chain = createMockChain({
      data: {
        id: "contract-1",
        supplier_id: "sup-1",
        provider_metadata: { supplier_signed_at: "2026-03-01T00:00:00Z" },
      },
    });
    mockCreateAdmin.mockReturnValue(chain as never);

    const event = {
      data: {
        recipientEvents: [{ routingOrder: "1", status: "completed" }],
      },
    };

    const res = await handleRecipientCompleted("env-123", event);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toBe("Already processed");
  });

  it("TC-DOCUSIGN-002: ignores supplier with non-completed status", async () => {
    const event = {
      data: {
        recipientEvents: [{ routingOrder: "1", status: "sent" }],
      },
    };

    const res = await handleRecipientCompleted("env-123", event);
    const body = await res.json();

    expect(body.message).toBe("Non-supplier recipient");
  });

  it("TC-DOCUSIGN-010: returns 500 when supplier status update fails", async () => {
    // Contract found, no prior supplier_signed_at
    const chain = createMockChain({
      data: {
        id: "contract-1",
        supplier_id: "sup-1",
        provider_metadata: {},
      },
    });
    // Make the supplier update call return an error
    let updateCallCount = 0;
    (chain.update as ReturnType<typeof vi.fn>).mockImplementation(() => {
      updateCallCount++;
      // First update = provider_metadata, second = supplier status
      if (updateCallCount >= 2) {
        return {
          eq: vi.fn().mockReturnValue({
            error: { message: "DB connection lost" },
            data: null,
          }),
        };
      }
      return chain;
    });
    // Mock storage for PDF download (will fail, which is fine)
    (chain as Record<string, unknown>).storage = {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: { message: "no bucket" } }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "" } }),
      }),
    };
    mockCreateAdmin.mockReturnValue(chain as never);

    const event = {
      data: {
        recipientEvents: [{ routingOrder: "1", status: "completed" }],
      },
    };

    const res = await handleRecipientCompleted("env-123", event);
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error).toContain("Failed to update supplier");
  });
});

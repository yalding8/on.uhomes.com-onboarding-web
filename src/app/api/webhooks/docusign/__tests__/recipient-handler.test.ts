/**
 * DocuSign recipient-completed handler tests (mocked dependencies).
 *
 * TC-DOCUSIGN-002: Non-supplier recipient → ignored
 * TC-DOCUSIGN-003: Idempotent when supplier_signed_at exists
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
});

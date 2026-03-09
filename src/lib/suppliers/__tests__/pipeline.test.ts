import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  computePipelineStage,
  getNextAction,
  computeStageDays,
  PIPELINE_STAGES,
} from "../pipeline";

describe("computePipelineStage", () => {
  it("returns NEW_CONTRACT when no contract exists", () => {
    expect(computePipelineStage("ACTIVE", null, [])).toBe("NEW_CONTRACT");
  });

  it("returns CONTRACT_IN_PROGRESS for DRAFT contract", () => {
    expect(computePipelineStage("ACTIVE", "DRAFT", [])).toBe(
      "CONTRACT_IN_PROGRESS",
    );
  });

  it("returns CONTRACT_IN_PROGRESS for PENDING_REVIEW contract", () => {
    expect(computePipelineStage("ACTIVE", "PENDING_REVIEW", [])).toBe(
      "CONTRACT_IN_PROGRESS",
    );
  });

  it("returns CONTRACT_IN_PROGRESS for CONFIRMED contract", () => {
    expect(computePipelineStage("ACTIVE", "CONFIRMED", [])).toBe(
      "CONTRACT_IN_PROGRESS",
    );
  });

  it("returns AWAITING_SIGNATURE for SENT contract", () => {
    expect(computePipelineStage("ACTIVE", "SENT", [])).toBe(
      "AWAITING_SIGNATURE",
    );
  });

  it("returns SIGNED when supplier is SIGNED with no published buildings", () => {
    const buildings = [{ onboarding_status: "incomplete" }];
    expect(computePipelineStage("SIGNED", "SENT", buildings)).toBe("SIGNED");
  });

  it("returns SIGNED when supplier is SIGNED with empty buildings", () => {
    expect(computePipelineStage("SIGNED", null, [])).toBe("SIGNED");
  });

  it("returns LIVE when supplier is SIGNED with published building", () => {
    const buildings = [
      { onboarding_status: "incomplete" },
      { onboarding_status: "published" },
    ];
    expect(computePipelineStage("SIGNED", "SENT", buildings)).toBe("LIVE");
  });

  it("returns LIVE when all buildings are published", () => {
    const buildings = [
      { onboarding_status: "published" },
      { onboarding_status: "published" },
    ];
    expect(computePipelineStage("SIGNED", "SENT", buildings)).toBe("LIVE");
  });

  it("supplier status SIGNED takes priority over contract status", () => {
    expect(computePipelineStage("SIGNED", "DRAFT", [])).toBe("SIGNED");
    expect(computePipelineStage("SIGNED", null, [])).toBe("SIGNED");
  });
});

describe("getNextAction", () => {
  it("NEW_CONTRACT: suggests creating contract", () => {
    const result = getNextAction("NEW_CONTRACT", null, []);
    expect(result.text).toContain("Create contract");
  });

  it("CONTRACT_IN_PROGRESS + DRAFT: suggests completing edit", () => {
    const result = getNextAction("CONTRACT_IN_PROGRESS", "DRAFT", []);
    expect(result.text).toContain("Complete contract editing");
  });

  it("CONTRACT_IN_PROGRESS + PENDING_REVIEW: suggests review", () => {
    const result = getNextAction("CONTRACT_IN_PROGRESS", "PENDING_REVIEW", []);
    expect(result.text).toContain("Review and confirm");
  });

  it("CONTRACT_IN_PROGRESS + CONFIRMED: suggests sending", () => {
    const result = getNextAction("CONTRACT_IN_PROGRESS", "CONFIRMED", []);
    expect(result.text).toContain("Send contract");
  });

  it("AWAITING_SIGNATURE: suggests follow up with copy_email action", () => {
    const result = getNextAction("AWAITING_SIGNATURE", "SENT", []);
    expect(result.text).toContain("Follow up");
    expect(result.actionType).toBe("copy_email");
  });

  it("SIGNED with incomplete buildings: shows count", () => {
    const buildings = [
      { onboarding_status: "incomplete", score: 30 },
      { onboarding_status: "incomplete", score: 20 },
      { onboarding_status: "previewable", score: 80 },
    ];
    const result = getNextAction("SIGNED", "SENT", buildings);
    expect(result.text).toBe("2 building(s) need more data");
  });

  it("SIGNED with reviewable buildings: shows count", () => {
    const buildings = [
      { onboarding_status: "previewable", score: 80 },
      { onboarding_status: "ready_to_publish", score: 90 },
    ];
    const result = getNextAction("SIGNED", "SENT", buildings);
    expect(result.text).toBe("2 building(s) ready for review");
  });

  it("SIGNED with no actionable buildings: monitor", () => {
    const buildings = [{ onboarding_status: "published", score: 100 }];
    const result = getNextAction("SIGNED", "SENT", buildings);
    expect(result.text).toContain("Monitor");
  });

  it("LIVE: operational maintenance", () => {
    const result = getNextAction("LIVE", "SENT", []);
    expect(result.text).toContain("published");
  });
});

describe("computeStageDays", () => {
  const NOW = new Date("2026-03-08T12:00:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("NEW_CONTRACT: days since supplier creation", () => {
    const days = computeStageDays(
      "NEW_CONTRACT",
      "2026-03-01T12:00:00Z",
      null,
      null,
      null,
    );
    expect(days).toBe(7);
  });

  it("CONTRACT_IN_PROGRESS: days since contract creation", () => {
    const days = computeStageDays(
      "CONTRACT_IN_PROGRESS",
      "2026-02-01T00:00:00Z",
      "2026-03-05T12:00:00Z",
      null,
      null,
    );
    expect(days).toBe(3);
  });

  it("CONTRACT_IN_PROGRESS: falls back to supplier created_at", () => {
    const days = computeStageDays(
      "CONTRACT_IN_PROGRESS",
      "2026-03-06T12:00:00Z",
      null,
      null,
      null,
    );
    expect(days).toBe(2);
  });

  it("AWAITING_SIGNATURE: days since contract updated_at", () => {
    const days = computeStageDays(
      "AWAITING_SIGNATURE",
      "2026-02-01T00:00:00Z",
      "2026-02-15T00:00:00Z",
      "2026-03-07T12:00:00Z",
      null,
    );
    expect(days).toBe(1);
  });

  it("SIGNED: days since signed_at", () => {
    const days = computeStageDays(
      "SIGNED",
      "2026-01-01T00:00:00Z",
      "2026-01-15T00:00:00Z",
      "2026-02-01T00:00:00Z",
      "2026-03-06T12:00:00Z",
    );
    expect(days).toBe(2);
  });

  it("LIVE: always returns 0", () => {
    const days = computeStageDays(
      "LIVE",
      "2026-01-01T00:00:00Z",
      "2026-01-15T00:00:00Z",
      "2026-02-01T00:00:00Z",
      "2026-03-01T00:00:00Z",
    );
    expect(days).toBe(0);
  });

  it("returns 0 for future dates", () => {
    const days = computeStageDays(
      "NEW_CONTRACT",
      "2026-03-10T12:00:00Z",
      null,
      null,
      null,
    );
    expect(days).toBe(0);
  });
});

describe("PIPELINE_STAGES", () => {
  it("has 5 stages in correct order", () => {
    expect(PIPELINE_STAGES).toHaveLength(5);
    expect(PIPELINE_STAGES.map((s) => s.value)).toEqual([
      "NEW_CONTRACT",
      "CONTRACT_IN_PROGRESS",
      "AWAITING_SIGNATURE",
      "SIGNED",
      "LIVE",
    ]);
  });

  it("all stages have label and color", () => {
    for (const stage of PIPELINE_STAGES) {
      expect(stage.label).toBeTruthy();
      expect(stage.color).toBeTruthy();
    }
  });
});

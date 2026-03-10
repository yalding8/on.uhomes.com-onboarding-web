import { describe, it, expect } from "vitest";
import { resolveStatus, PREVIEWABLE_THRESHOLD } from "../status-engine";

describe("resolveStatus", () => {
  const T = PREVIEWABLE_THRESHOLD; // 70

  it("upgrades incomplete → previewable when score crosses threshold", () => {
    expect(resolveStatus("incomplete", T - 1, T)).toBe("previewable");
  });

  it("downgrades previewable → incomplete when score drops below threshold", () => {
    expect(resolveStatus("previewable", T, T - 1)).toBe("incomplete");
  });

  it("stays incomplete when score stays below threshold", () => {
    expect(resolveStatus("incomplete", 50, T - 1)).toBe("incomplete");
  });

  it("stays previewable when score stays above threshold", () => {
    expect(resolveStatus("previewable", T + 5, T + 10)).toBe("previewable");
  });

  it("does not change ready_to_publish regardless of score", () => {
    expect(resolveStatus("ready_to_publish", 90, 50)).toBe("ready_to_publish");
  });

  it("does not change published regardless of score", () => {
    expect(resolveStatus("published", T, 30)).toBe("published");
  });

  it("does not change extracting regardless of score", () => {
    expect(resolveStatus("extracting", 0, 100)).toBe("extracting");
  });

  it("handles boundary: incomplete with score exactly at threshold", () => {
    expect(resolveStatus("incomplete", 0, T)).toBe("previewable");
  });

  it("handles boundary: previewable with score exactly below threshold", () => {
    expect(resolveStatus("previewable", 100, T - 1)).toBe("incomplete");
  });

  it("threshold is 70", () => {
    expect(PREVIEWABLE_THRESHOLD).toBe(70);
  });
});

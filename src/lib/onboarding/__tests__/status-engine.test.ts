import { describe, it, expect } from "vitest";
import { resolveStatus } from "../status-engine";

describe("resolveStatus", () => {
  it("upgrades incomplete → previewable when score crosses 80", () => {
    expect(resolveStatus("incomplete", 79, 80)).toBe("previewable");
  });

  it("downgrades previewable → incomplete when score drops below 80", () => {
    expect(resolveStatus("previewable", 80, 79)).toBe("incomplete");
  });

  it("stays incomplete when score stays below 80", () => {
    expect(resolveStatus("incomplete", 50, 70)).toBe("incomplete");
  });

  it("stays previewable when score stays above 80", () => {
    expect(resolveStatus("previewable", 85, 90)).toBe("previewable");
  });

  it("does not change ready_to_publish regardless of score", () => {
    expect(resolveStatus("ready_to_publish", 90, 50)).toBe("ready_to_publish");
  });

  it("does not change published regardless of score", () => {
    expect(resolveStatus("published", 80, 30)).toBe("published");
  });

  it("does not change extracting regardless of score", () => {
    expect(resolveStatus("extracting", 0, 100)).toBe("extracting");
  });

  it("handles boundary: incomplete with score exactly 80", () => {
    expect(resolveStatus("incomplete", 0, 80)).toBe("previewable");
  });

  it("handles boundary: previewable with score exactly 79", () => {
    expect(resolveStatus("previewable", 100, 79)).toBe("incomplete");
  });
});

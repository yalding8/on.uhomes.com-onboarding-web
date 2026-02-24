import { describe, it, expect } from "vitest";
import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";
import {
  VALID_TRANSITIONS,
  canTransition,
  validateTransition,
  isEditable,
} from "../status-machine";
import type { ContractStatus } from "../types";

const ALL_STATUSES: ContractStatus[] = [
  "DRAFT",
  "PENDING_REVIEW",
  "CONFIRMED",
  "SENT",
  "SIGNED",
  "CANCELED",
];

describe("VALID_TRANSITIONS", () => {
  it("covers all ContractStatus keys", () => {
    expect(Object.keys(VALID_TRANSITIONS).sort()).toEqual(
      [...ALL_STATUSES].sort(),
    );
  });
});

describe("canTransition", () => {
  // --- 合法转换 ---
  const validCases: [ContractStatus, ContractStatus][] = [
    ["DRAFT", "PENDING_REVIEW"],
    ["DRAFT", "CANCELED"],
    ["PENDING_REVIEW", "CONFIRMED"],
    ["PENDING_REVIEW", "DRAFT"],
    ["PENDING_REVIEW", "CANCELED"],
    ["CONFIRMED", "SENT"],
    ["CONFIRMED", "CANCELED"],
    ["SENT", "SIGNED"],
  ];

  it.each(validCases)("%s → %s should be allowed", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  // --- 非法转换 ---
  const invalidCases: [ContractStatus, ContractStatus][] = [
    ["DRAFT", "SENT"],
    ["DRAFT", "SIGNED"],
    ["DRAFT", "CONFIRMED"],
    ["PENDING_REVIEW", "SENT"],
    ["PENDING_REVIEW", "SIGNED"],
    ["CONFIRMED", "DRAFT"],
    ["CONFIRMED", "SIGNED"],
    ["SENT", "DRAFT"],
    ["SENT", "CANCELED"],
    ["SIGNED", "DRAFT"],
    ["SIGNED", "CANCELED"],
    ["CANCELED", "DRAFT"],
    ["CANCELED", "SENT"],
  ];

  it.each(invalidCases)("%s → %s should be rejected", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });
});

describe("validateTransition", () => {
  it("returns { valid: true } for a legal transition", () => {
    expect(validateTransition("DRAFT", "PENDING_REVIEW")).toEqual({
      valid: true,
    });
  });

  it("returns reason when transition is illegal", () => {
    const result = validateTransition("DRAFT", "SIGNED");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain("DRAFT");
      expect(result.reason).toContain("SIGNED");
    }
  });

  it("returns reason for same-state transition", () => {
    const result = validateTransition("DRAFT", "DRAFT");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain("DRAFT");
    }
  });

  it("returns terminal-state reason for SIGNED", () => {
    const result = validateTransition("SIGNED", "DRAFT");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain("终态");
    }
  });

  it("returns terminal-state reason for CANCELED", () => {
    const result = validateTransition("CANCELED", "DRAFT");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain("终态");
    }
  });

  // Req 1.3: DRAFT / PENDING_REVIEW / CONFIRMED → CANCELED 合法
  it.each<ContractStatus>(["DRAFT", "PENDING_REVIEW", "CONFIRMED"])(
    "%s → CANCELED should be valid (Req 1.3)",
    (from) => {
      expect(validateTransition(from, "CANCELED")).toEqual({ valid: true });
    },
  );

  // Req 1.4: SENT / SIGNED → CANCELED 非法
  it.each<ContractStatus>(["SENT", "SIGNED"])(
    "%s → CANCELED should be invalid (Req 1.4)",
    (from) => {
      const result = validateTransition(from, "CANCELED");
      expect(result.valid).toBe(false);
    },
  );
});

describe("isEditable", () => {
  it("returns true only for DRAFT", () => {
    expect(isEditable("DRAFT")).toBe(true);
  });

  it.each<ContractStatus>([
    "PENDING_REVIEW",
    "CONFIRMED",
    "SENT",
    "SIGNED",
    "CANCELED",
  ])("returns false for %s", (status) => {
    expect(isEditable(status)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Property-Based Tests (fast-check)
// ---------------------------------------------------------------------------

/** Arbitrary: 生成任意 ContractStatus */
const arbContractStatus: fc.Arbitrary<ContractStatus> = fc.constantFrom(
  ...ALL_STATUSES,
);

/**
 * Feature: online-contract-signing, Property 1: 合同状态机转换正确性
 *
 * 对于任意当前状态和目标状态的组合，`canTransition(from, to)` 返回 `true`
 * 当且仅当该转换存在于合法转换表中。
 *
 * **Validates: Requirements 1.1, 1.3, 1.4, 1.5**
 */
describe("Property 1: 合同状态机转换正确性", () => {
  fcTest.prop([arbContractStatus, arbContractStatus], { numRuns: 200 })(
    "canTransition(from, to) === VALID_TRANSITIONS[from].includes(to)",
    (from, to) => {
      const expected = VALID_TRANSITIONS[from].includes(to);
      expect(canTransition(from, to)).toBe(expected);
    },
  );

  fcTest.prop([arbContractStatus, arbContractStatus], { numRuns: 200 })(
    "validateTransition 与 canTransition 结果一致（排除 from===to 的情况）",
    (from, to) => {
      if (from === to) {
        // 同状态转换始终无效
        const result = validateTransition(from, to);
        expect(result.valid).toBe(false);
        return;
      }
      const result = validateTransition(from, to);
      expect(result.valid).toBe(canTransition(from, to));
    },
  );

  fcTest.prop([arbContractStatus], { numRuns: 100 })(
    "SIGNED 和 CANCELED 为终态，不能转到任何状态",
    (to) => {
      if (to !== "SIGNED") {
        expect(canTransition("SIGNED", to)).toBe(false);
      }
      if (to !== "CANCELED") {
        expect(canTransition("CANCELED", to)).toBe(false);
      }
    },
  );

  fcTest.prop(
    [fc.constantFrom<ContractStatus>("DRAFT", "PENDING_REVIEW", "CONFIRMED")],
    { numRuns: 100 },
  )(
    "DRAFT / PENDING_REVIEW / CONFIRMED 可以转到 CANCELED (Req 1.3)",
    (from) => {
      expect(canTransition(from, "CANCELED")).toBe(true);
    },
  );

  fcTest.prop([fc.constantFrom<ContractStatus>("SENT", "SIGNED")], {
    numRuns: 100,
  })("SENT / SIGNED 不能转到 CANCELED (Req 1.4)", (from) => {
    expect(canTransition(from, "CANCELED")).toBe(false);
  });
});

/**
 * Feature: online-contract-signing, Property 4: 合同可编辑性由状态决定
 *
 * 对于任意合同状态，合同可编辑当且仅当状态为 DRAFT。
 * 所有其他状态（PENDING_REVIEW、CONFIRMED、SENT、SIGNED、CANCELED）下合同应为只读。
 *
 * **Validates: Requirements 1.1, 1.3, 1.4, 1.5, 3.5**
 */
describe("Property 4: 合同可编辑性由状态决定", () => {
  fcTest.prop([arbContractStatus], { numRuns: 200 })(
    'isEditable(status) === (status === "DRAFT")',
    (status) => {
      expect(isEditable(status)).toBe(status === "DRAFT");
    },
  );
});

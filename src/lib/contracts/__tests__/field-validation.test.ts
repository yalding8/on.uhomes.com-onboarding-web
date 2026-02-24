import { describe, it, expect } from "vitest";
import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";
import { validateContractFields, getMissingFields } from "../field-validation";
import type { ContractFields } from "../types";
import { CONTRACT_FIELD_KEYS } from "../types";

/** 构造一组完整且合法的合同字段 */
function validFields(): ContractFields {
  return {
    partner_company_name: "Acme Properties Ltd",
    partner_contact_name: "John Smith",
    partner_address: "123 Main St",
    partner_city: "London",
    partner_country: "UK",
    commission_rate: "15",
    contract_start_date: "2026-03-01",
    contract_end_date: "2027-02-28",
    covered_properties: "All London properties",
  };
}

describe("validateContractFields", () => {
  it("所有字段合法时返回 valid: true", () => {
    const result = validateContractFields(validFields());
    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  // --- 必填字段非空校验 ---
  it.each([
    "partner_company_name",
    "partner_contact_name",
    "partner_address",
    "partner_city",
    "partner_country",
    "covered_properties",
  ] as const)("当 %s 为空字符串时返回错误", (field) => {
    const fields = { ...validFields(), [field]: "" };
    const result = validateContractFields(fields);
    expect(result.valid).toBe(false);
    expect(result.errors[field]).toBeDefined();
  });

  it.each([
    "partner_company_name",
    "partner_contact_name",
    "partner_address",
    "partner_city",
    "partner_country",
    "covered_properties",
  ] as const)("当 %s 缺失时返回错误", (field) => {
    const fields = { ...validFields() };
    delete (fields as Partial<ContractFields>)[field];
    const result = validateContractFields(fields);
    expect(result.valid).toBe(false);
    expect(result.errors[field]).toBeDefined();
  });

  it("当字段仅含空白字符时返回错误", () => {
    const fields = { ...validFields(), partner_company_name: "   " };
    const result = validateContractFields(fields);
    expect(result.valid).toBe(false);
    expect(result.errors.partner_company_name).toBeDefined();
  });

  // --- commission_rate 校验 ---
  it("commission_rate 为空时返回错误", () => {
    const fields = { ...validFields(), commission_rate: "" };
    const result = validateContractFields(fields);
    expect(result.valid).toBe(false);
    expect(result.errors.commission_rate).toContain("必填");
  });

  it("commission_rate 非数值时返回错误", () => {
    const fields = { ...validFields(), commission_rate: "abc" };
    const result = validateContractFields(fields);
    expect(result.valid).toBe(false);
    expect(result.errors.commission_rate).toContain("有效数值");
  });

  it("commission_rate 小于 0 时返回错误", () => {
    const fields = { ...validFields(), commission_rate: "-1" };
    const result = validateContractFields(fields);
    expect(result.valid).toBe(false);
    expect(result.errors.commission_rate).toContain("0 到 100");
  });

  it("commission_rate 大于 100 时返回错误", () => {
    const fields = { ...validFields(), commission_rate: "101" };
    const result = validateContractFields(fields);
    expect(result.valid).toBe(false);
    expect(result.errors.commission_rate).toContain("0 到 100");
  });

  it("commission_rate 边界值 0 合法", () => {
    const fields = { ...validFields(), commission_rate: "0" };
    const result = validateContractFields(fields);
    expect(result.errors.commission_rate).toBeUndefined();
  });

  it("commission_rate 边界值 100 合法", () => {
    const fields = { ...validFields(), commission_rate: "100" };
    const result = validateContractFields(fields);
    expect(result.errors.commission_rate).toBeUndefined();
  });

  it("commission_rate 小数值合法", () => {
    const fields = { ...validFields(), commission_rate: "12.5" };
    const result = validateContractFields(fields);
    expect(result.errors.commission_rate).toBeUndefined();
  });

  // --- 日期校验 ---
  it("contract_start_date 为空时返回错误", () => {
    const fields = { ...validFields(), contract_start_date: "" };
    const result = validateContractFields(fields);
    expect(result.valid).toBe(false);
    expect(result.errors.contract_start_date).toContain("必填");
  });

  it("contract_start_date 格式无效时返回错误", () => {
    const fields = { ...validFields(), contract_start_date: "not-a-date" };
    const result = validateContractFields(fields);
    expect(result.valid).toBe(false);
    expect(result.errors.contract_start_date).toContain("有效日期");
  });

  it("contract_end_date 为空时返回错误", () => {
    const fields = { ...validFields(), contract_end_date: "" };
    const result = validateContractFields(fields);
    expect(result.valid).toBe(false);
    expect(result.errors.contract_end_date).toContain("必填");
  });

  it("contract_end_date 格式无效时返回错误", () => {
    const fields = { ...validFields(), contract_end_date: "xyz" };
    const result = validateContractFields(fields);
    expect(result.valid).toBe(false);
    expect(result.errors.contract_end_date).toContain("有效日期");
  });

  it("contract_end_date 早于 start_date 时返回错误", () => {
    const fields = {
      ...validFields(),
      contract_start_date: "2026-06-01",
      contract_end_date: "2026-01-01",
    };
    const result = validateContractFields(fields);
    expect(result.valid).toBe(false);
    expect(result.errors.contract_end_date).toContain("晚于");
  });

  it("contract_end_date 等于 start_date 时返回错误", () => {
    const fields = {
      ...validFields(),
      contract_start_date: "2026-06-01",
      contract_end_date: "2026-06-01",
    };
    const result = validateContractFields(fields);
    expect(result.valid).toBe(false);
    expect(result.errors.contract_end_date).toContain("晚于");
  });

  // --- 多字段同时错误 ---
  it("多个字段同时无效时返回所有错误", () => {
    const result = validateContractFields({});
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors).length).toBe(9);
  });

  it("仅 start_date 无效时不报 end_date 的先后顺序错误", () => {
    const fields = {
      ...validFields(),
      contract_start_date: "invalid",
      contract_end_date: "2027-01-01",
    };
    const result = validateContractFields(fields);
    expect(result.errors.contract_start_date).toContain("有效日期");
    expect(result.errors.contract_end_date).toBeUndefined();
  });
});

describe("getMissingFields", () => {
  it("所有字段都填写时返回空数组", () => {
    expect(getMissingFields(validFields())).toHaveLength(0);
  });

  it("空对象返回所有 9 个字段", () => {
    expect(getMissingFields({})).toHaveLength(9);
  });

  it("仅缺少一个字段时返回该字段", () => {
    const fields = { ...validFields() };
    delete (fields as Partial<ContractFields>).commission_rate;
    const missing = getMissingFields(fields);
    expect(missing).toEqual(["commission_rate"]);
  });
});

// ---------------------------------------------------------------------------
// Property-Based Tests (fast-check)
// ---------------------------------------------------------------------------

/** 生成非空非纯空白字符串（仅 ASCII 字母数字） */
const arbNonEmptyString: fc.Arbitrary<string> = fc
  .stringMatching(/^[a-zA-Z0-9 ]{1,30}$/)
  .filter((s) => s.trim().length > 0);

/** 生成合法的 commission_rate 字符串（0–100 范围内的整数或一位小数） */
const arbValidRate: fc.Arbitrary<string> = fc
  .integer({ min: 0, max: 1000 })
  .map((n) => String(n / 10));

/** 生成非数值字符串（用于测试 commission_rate 非法输入） */
const arbInvalidRate: fc.Arbitrary<string> = fc.stringMatching(
  /^[a-zA-Z!@#$%^&*]{1,10}$/,
);

/** 生成超出 0-100 范围的数值字符串 */
const arbOutOfRangeRate: fc.Arbitrary<string> = fc.oneof(
  fc.integer({ min: -1000, max: -1 }).map(String),
  fc.integer({ min: 101, max: 10000 }).map(String),
);

/** 将年月日格式化为 YYYY-MM-DD */
function toISODateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 生成合法的 ISO 日期字符串 (YYYY-MM-DD) */
const arbISODate: fc.Arbitrary<string> = fc
  .tuple(
    fc.integer({ min: 2020, max: 2080 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }),
  )
  .map(([y, m, d]) => toISODateStr(y, m, d));

/**
 * 生成一对合法的 start/end 日期（start 严格早于 end）
 * 通过确保 end 的年份 > start 的年份来保证 end > start
 */
const arbValidDatePair: fc.Arbitrary<{ start: string; end: string }> = fc
  .tuple(
    fc.integer({ min: 2020, max: 2070 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }),
    fc.integer({ min: 1, max: 10 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }),
  )
  .map(([sy, sm, sd, yearOffset, em, ed]) => ({
    start: toISODateStr(sy, sm, sd),
    end: toISODateStr(sy + yearOffset, em, ed),
  }));

/** 生成完整且合法的 ContractFields */
const arbValidContractFields: fc.Arbitrary<ContractFields> =
  arbValidDatePair.chain(({ start, end }) =>
    fc.record({
      partner_company_name: arbNonEmptyString,
      partner_contact_name: arbNonEmptyString,
      partner_address: arbNonEmptyString,
      partner_city: arbNonEmptyString,
      partner_country: arbNonEmptyString,
      commission_rate: arbValidRate,
      contract_start_date: fc.constant(start),
      contract_end_date: fc.constant(end),
      covered_properties: arbNonEmptyString,
    }),
  );

/** 必填文本字段列表 */
const REQUIRED_TEXT_KEYS: ReadonlyArray<keyof ContractFields> = [
  "partner_company_name",
  "partner_contact_name",
  "partner_address",
  "partner_city",
  "partner_country",
  "covered_properties",
] as const;

/**
 * Feature: online-contract-signing, Property 2: 合同字段验证完整性
 *
 * 对于任意合同字段输入集合，验证函数应满足：
 * - 当任一必填字段为空时返回无效并列出该字段
 * - 当 commission_rate 不是有效数值或超出 0-100 范围时返回无效
 * - 当 contract_start_date 不早于 contract_end_date 时返回无效
 * - 当所有字段均合法时返回有效
 * - 验证结果的 errors 对象应精确包含所有不合法字段的键
 *
 * **Validates: Requirements 3.3, 4.1, 4.3**
 */
describe("Property 2: 合同字段验证完整性", () => {
  // 2a: 所有字段合法时，验证结果为 valid
  fcTest.prop([arbValidContractFields], { numRuns: 100 })(
    "所有字段合法时返回 valid: true 且 errors 为空",
    (fields) => {
      const result = validateContractFields(fields);
      expect(result.valid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    },
  );

  // 2b: 任一必填文本字段为空时，errors 中包含该字段
  fcTest.prop(
    [
      arbValidContractFields,
      fc.constantFrom(...REQUIRED_TEXT_KEYS),
      fc.constantFrom("", "   "),
    ],
    { numRuns: 100 },
  )(
    "任一必填文本字段为空/空白时返回 invalid 且 errors 包含该字段",
    (fields, fieldKey, emptyValue) => {
      const modified: Partial<ContractFields> = {
        ...fields,
        [fieldKey]: emptyValue,
      };
      const result = validateContractFields(modified);
      expect(result.valid).toBe(false);
      expect(result.errors[fieldKey]).toBeDefined();
    },
  );

  // 2c: commission_rate 非数值时返回 invalid
  fcTest.prop([arbValidContractFields, arbInvalidRate], { numRuns: 100 })(
    "commission_rate 非数值时返回 invalid 且 errors 包含 commission_rate",
    (fields, badRate) => {
      const modified: Partial<ContractFields> = {
        ...fields,
        commission_rate: badRate,
      };
      const result = validateContractFields(modified);
      expect(result.valid).toBe(false);
      expect(result.errors.commission_rate).toBeDefined();
    },
  );

  // 2d: commission_rate 超出 0-100 范围时返回 invalid
  fcTest.prop([arbValidContractFields, arbOutOfRangeRate], { numRuns: 100 })(
    "commission_rate 超出 0-100 范围时返回 invalid 且 errors 包含 commission_rate",
    (fields, badRate) => {
      const modified: Partial<ContractFields> = {
        ...fields,
        commission_rate: badRate,
      };
      const result = validateContractFields(modified);
      expect(result.valid).toBe(false);
      expect(result.errors.commission_rate).toBeDefined();
    },
  );

  // 2e: end_date 不晚于 start_date 时返回 invalid
  fcTest.prop([arbValidContractFields, arbISODate], { numRuns: 100 })(
    "contract_end_date 等于或早于 contract_start_date 时返回 invalid",
    (fields, date) => {
      // 让 start 和 end 相同
      const sameDate: Partial<ContractFields> = {
        ...fields,
        contract_start_date: date,
        contract_end_date: date,
      };
      const result1 = validateContractFields(sameDate);
      expect(result1.valid).toBe(false);
      expect(result1.errors.contract_end_date).toBeDefined();

      // 构造一个比 date 早的日期（年份减 1）
      const year = parseInt(date.slice(0, 4), 10);
      const earlier = `${year - 1}${date.slice(4)}`;
      const reversed: Partial<ContractFields> = {
        ...fields,
        contract_start_date: date,
        contract_end_date: earlier,
      };
      const result2 = validateContractFields(reversed);
      expect(result2.valid).toBe(false);
      expect(result2.errors.contract_end_date).toBeDefined();
    },
  );

  // 2f: errors 对象精确包含所有不合法字段的键
  fcTest.prop(
    [
      arbValidContractFields,
      fc.subarray([...CONTRACT_FIELD_KEYS], { minLength: 1 }),
    ],
    { numRuns: 100 },
  )("errors 精确包含被清空的字段键", (fields, fieldsToEmpty) => {
    const modified: Record<string, string> = { ...fields };
    for (const key of fieldsToEmpty) {
      modified[key] = "";
    }
    const result = validateContractFields(modified as Partial<ContractFields>);
    expect(result.valid).toBe(false);

    // 每个被清空的字段都应出现在 errors 中
    for (const key of fieldsToEmpty) {
      expect(result.errors[key]).toBeDefined();
    }

    // errors 中不应包含未被清空的合法字段
    // 例外：清空 start_date 时 end_date 不会报先后顺序错误（正确行为）
    const errorKeys = new Set(Object.keys(result.errors));
    for (const key of CONTRACT_FIELD_KEYS) {
      if (!fieldsToEmpty.includes(key) && errorKeys.has(key)) {
        if (key !== "contract_end_date" && key !== "contract_start_date") {
          expect(errorKeys.has(key)).toBe(false);
        }
      }
    }
  });
});

/**
 * Feature: online-contract-signing, Property 3: 合同字段持久化往返一致性
 *
 * 对于任意有效的合同字段对象，将其序列化存储到 contract_fields JSONB 列后
 * 再读取回来，应产生与原始对象等价的值。
 *
 * 模拟 JSONB 往返：JSON.parse(JSON.stringify(fields))
 *
 * **Validates: Requirements 3.4**
 */
describe("Property 3: 合同字段持久化往返一致性", () => {
  fcTest.prop([arbValidContractFields], { numRuns: 100 })(
    "JSON 序列化后反序列化应与原始对象等价",
    (fields) => {
      const serialized = JSON.stringify(fields);
      const deserialized = JSON.parse(serialized) as ContractFields;

      // 所有字段值应完全一致
      for (const key of CONTRACT_FIELD_KEYS) {
        expect(deserialized[key]).toBe(fields[key]);
      }

      // 反序列化后的对象应通过相同的验证
      const originalResult = validateContractFields(fields);
      const roundTripResult = validateContractFields(deserialized);
      expect(roundTripResult.valid).toBe(originalResult.valid);
      expect(roundTripResult.errors).toEqual(originalResult.errors);
    },
  );

  fcTest.prop([arbValidContractFields], { numRuns: 100 })(
    "往返后字段数量不变，无额外键",
    (fields) => {
      const deserialized = JSON.parse(JSON.stringify(fields));
      expect(Object.keys(deserialized).sort()).toEqual(
        Object.keys(fields).sort(),
      );
    },
  );
});

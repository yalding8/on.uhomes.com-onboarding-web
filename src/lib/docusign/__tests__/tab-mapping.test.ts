import { describe, it, expect } from "vitest";
import { buildTextTabs } from "../tab-mapping";
import {
  CONTRACT_FIELD_KEYS,
  type ContractFields,
} from "@/lib/contracts/types";

/** 构造一个有效的 ContractFields 测试对象 */
function makeFields(overrides?: Partial<ContractFields>): ContractFields {
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
    ...overrides,
  };
}

describe("buildTextTabs", () => {
  it("应返回与 CONTRACT_FIELD_KEYS 等长的数组", () => {
    const tabs = buildTextTabs(makeFields());
    expect(tabs).toHaveLength(CONTRACT_FIELD_KEYS.length);
  });

  it("每个 tab 的 tabLabel 应与字段名一一对应", () => {
    const tabs = buildTextTabs(makeFields());
    const labels = tabs.map((t) => t.tabLabel);
    expect(labels).toEqual([...CONTRACT_FIELD_KEYS]);
  });

  it("每个 tab 的 value 应与字段值匹配", () => {
    const fields = makeFields();
    const tabs = buildTextTabs(fields);

    for (const tab of tabs) {
      const key = tab.tabLabel as keyof ContractFields;
      expect(tab.value).toBe(fields[key]);
    }
  });

  it("应正确处理包含特殊字符的字段值", () => {
    const fields = makeFields({
      partner_company_name: 'O\'Brien & Co. "Ltd"',
      partner_address: "123 Main St, Apt #4B",
      covered_properties: "Building A\nBuilding B",
    });
    const tabs = buildTextTabs(fields);
    const nameTab = tabs.find((t) => t.tabLabel === "partner_company_name");
    expect(nameTab?.value).toBe('O\'Brien & Co. "Ltd"');
  });

  it("应正确处理空字符串字段值", () => {
    const fields = makeFields({
      partner_address: "",
      covered_properties: "",
    });
    const tabs = buildTextTabs(fields);
    const addressTab = tabs.find((t) => t.tabLabel === "partner_address");
    expect(addressTab?.value).toBe("");
  });

  it("返回的 tab 对象应仅包含 tabLabel 和 value 属性", () => {
    const tabs = buildTextTabs(makeFields());
    for (const tab of tabs) {
      expect(Object.keys(tab).sort()).toEqual(["tabLabel", "value"]);
    }
  });

  it("返回的数组顺序应与 CONTRACT_FIELD_KEYS 顺序一致", () => {
    const tabs = buildTextTabs(makeFields());
    tabs.forEach((tab, index) => {
      expect(tab.tabLabel).toBe(CONTRACT_FIELD_KEYS[index]);
    });
  });
});

// ---------------------------------------------------------------------------
// Property-Based Tests (fast-check)
// ---------------------------------------------------------------------------

import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";

/** Arbitrary: 生成非空字符串，用于合同字段值 */
const arbNonEmptyString = fc.string({ minLength: 1, maxLength: 500 });

/** Arbitrary: 生成有效的 ContractFields 对象 */
const arbContractFields: fc.Arbitrary<ContractFields> = fc.record({
  partner_company_name: arbNonEmptyString,
  partner_contact_name: arbNonEmptyString,
  partner_address: arbNonEmptyString,
  partner_city: arbNonEmptyString,
  partner_country: arbNonEmptyString,
  commission_rate: arbNonEmptyString,
  contract_start_date: arbNonEmptyString,
  contract_end_date: arbNonEmptyString,
  covered_properties: arbNonEmptyString,
});

/**
 * Feature: online-contract-signing, Property 5: DocuSign Text Tabs 映射完整性
 *
 * 对于任意有效的合同字段对象，生成的 Text Tabs 数组应包含与所有 9 个动态字段
 * 一一对应的 tab 项，每个 tab 的 tabLabel 与字段名匹配，value 与字段值匹配。
 *
 * **Validates: Requirements 6.2**
 */
describe("Property 5: DocuSign Text Tabs 映射完整性", () => {
  fcTest.prop([arbContractFields], { numRuns: 200 })(
    "Text Tabs 数组长度应等于 CONTRACT_FIELD_KEYS 长度（9）",
    (fields) => {
      const tabs = buildTextTabs(fields);
      expect(tabs).toHaveLength(CONTRACT_FIELD_KEYS.length);
      expect(tabs).toHaveLength(9);
    },
  );

  fcTest.prop([arbContractFields], { numRuns: 200 })(
    "每个 tab 的 tabLabel 应与 CONTRACT_FIELD_KEYS 一一对应",
    (fields) => {
      const tabs = buildTextTabs(fields);
      const labels = tabs.map((t) => t.tabLabel);
      expect(labels).toEqual([...CONTRACT_FIELD_KEYS]);
    },
  );

  fcTest.prop([arbContractFields], { numRuns: 200 })(
    "每个 tab 的 value 应与对应字段值完全匹配",
    (fields) => {
      const tabs = buildTextTabs(fields);
      for (const tab of tabs) {
        const key = tab.tabLabel as keyof ContractFields;
        expect(tab.value).toBe(fields[key]);
      }
    },
  );

  fcTest.prop([arbContractFields], { numRuns: 200 })(
    "tabLabel 集合应覆盖所有 9 个动态字段名，无遗漏无多余",
    (fields) => {
      const tabs = buildTextTabs(fields);
      const labelSet = new Set(tabs.map((t) => t.tabLabel));
      const expectedSet = new Set<string>(CONTRACT_FIELD_KEYS);
      expect(labelSet).toEqual(expectedSet);
    },
  );

  fcTest.prop([arbContractFields], { numRuns: 100 })(
    "每个 tab 对象应仅包含 tabLabel 和 value 两个属性",
    (fields) => {
      const tabs = buildTextTabs(fields);
      for (const tab of tabs) {
        expect(Object.keys(tab).sort()).toEqual(["tabLabel", "value"]);
      }
    },
  );
});

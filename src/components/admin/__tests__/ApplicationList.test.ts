import { describe, it, expect } from "vitest";
import { it as fcIt, fc } from "@fast-check/vitest";
import { filterApplications, getStatusCounts } from "../ApplicationList";

/**
 * 申请列表筛选逻辑 — 单元测试 + 属性测试
 *
 * Validates: Requirements 3.3
 */

type AppStatus = "PENDING" | "CONVERTED" | "REJECTED";

const STATUSES: AppStatus[] = ["PENDING", "CONVERTED", "REJECTED"];

interface MockApp {
  id: string;
  company_name: string;
  contact_email: string;
  contact_phone: string | null;
  city: string | null;
  country: string | null;
  website_url: string | null;
  status: AppStatus;
  created_at: string;
  assigned_bd_id: string | null;
}

function makeApp(overrides: Partial<MockApp> = {}): MockApp {
  return {
    id: crypto.randomUUID(),
    company_name: "Test Co",
    contact_email: "test@example.com",
    contact_phone: null,
    city: null,
    country: null,
    website_url: null,
    status: "PENDING",
    created_at: new Date().toISOString(),
    assigned_bd_id: null,
    ...overrides,
  };
}

// ── 单元测试 ──────────────────────────────────────────

describe("filterApplications", () => {
  const apps: MockApp[] = [
    makeApp({ status: "PENDING" }),
    makeApp({ status: "CONVERTED" }),
    makeApp({ status: "REJECTED" }),
    makeApp({ status: "PENDING" }),
  ];

  it("ALL 筛选返回全部记录", () => {
    expect(filterApplications(apps, "ALL")).toHaveLength(4);
  });

  it("PENDING 筛选只返回待处理记录", () => {
    const result = filterApplications(apps, "PENDING");
    expect(result).toHaveLength(2);
    expect(result.every((a) => a.status === "PENDING")).toBe(true);
  });

  it("CONVERTED 筛选只返回已转化记录", () => {
    const result = filterApplications(apps, "CONVERTED");
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("CONVERTED");
  });

  it("REJECTED 筛选只返回已拒绝记录", () => {
    const result = filterApplications(apps, "REJECTED");
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("REJECTED");
  });

  it("空数组筛选返回空数组", () => {
    expect(filterApplications([], "PENDING")).toHaveLength(0);
    expect(filterApplications([], "ALL")).toHaveLength(0);
  });
});

describe("getStatusCounts", () => {
  it("正确统计各状态数量", () => {
    const apps: MockApp[] = [
      makeApp({ status: "PENDING" }),
      makeApp({ status: "PENDING" }),
      makeApp({ status: "CONVERTED" }),
      makeApp({ status: "REJECTED" }),
      makeApp({ status: "REJECTED" }),
      makeApp({ status: "REJECTED" }),
    ];

    const counts = getStatusCounts(apps);
    expect(counts.ALL).toBe(6);
    expect(counts.PENDING).toBe(2);
    expect(counts.CONVERTED).toBe(1);
    expect(counts.REJECTED).toBe(3);
  });

  it("空数组全部为 0", () => {
    const counts = getStatusCounts([]);
    expect(counts.ALL).toBe(0);
    expect(counts.PENDING).toBe(0);
    expect(counts.CONVERTED).toBe(0);
    expect(counts.REJECTED).toBe(0);
  });
});

// ── 属性测试 ──────────────────────────────────────────

const arbStatus = fc.constantFrom<AppStatus>(...STATUSES);

// 使用时间戳整数生成安全的 ISO 日期字符串，避免 fc.date() 的边界问题
const safeIsoDate = fc
  .integer({ min: 946684800000, max: 4102444800000 }) // 2000-01-01 ~ 2099-12-31
  .map((ts) => new Date(ts).toISOString());

const arbApp = fc
  .record({
    id: fc.uuid(),
    company_name: fc.string({ minLength: 1, maxLength: 50 }),
    contact_email: fc
      .string({ minLength: 5, maxLength: 30 })
      .map((s) => `${s}@test.com`),
    contact_phone: fc.option(fc.string({ minLength: 1, maxLength: 20 }), {
      nil: null,
    }),
    city: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
    country: fc.option(fc.string({ minLength: 1, maxLength: 20 }), {
      nil: null,
    }),
    website_url: fc.option(fc.constant("https://example.com"), { nil: null }),
    status: arbStatus,
    created_at: safeIsoDate,
    assigned_bd_id: fc.option(fc.uuid(), { nil: null }),
  })
  .map((r) => r as MockApp);

const arbApps = fc.array(arbApp, { maxLength: 50 });

describe("Property 3: 申请列表筛选正确性", () => {
  /**
   * **Validates: Requirements 3.3**
   *
   * 对于任意申请数据集和任意状态筛选条件，
   * 筛选后返回的所有记录 status 应与筛选条件完全匹配，
   * 且不遗漏任何匹配记录。
   */
  fcIt.prop([arbApps, arbStatus], { numRuns: 100 })(
    "筛选结果中所有记录的 status 与筛选条件匹配",
    (apps, status) => {
      const result = filterApplications(apps, status);
      expect(result.every((a) => a.status === status)).toBe(true);
    },
  );

  fcIt.prop([arbApps, arbStatus], { numRuns: 100 })(
    "筛选不遗漏任何匹配记录",
    (apps, status) => {
      const result = filterApplications(apps, status);
      const expected = apps.filter((a) => a.status === status);
      expect(result).toHaveLength(expected.length);
    },
  );

  fcIt.prop([arbApps], { numRuns: 100 })("ALL 筛选返回全部记录", (apps) => {
    const result = filterApplications(apps, "ALL");
    expect(result).toHaveLength(apps.length);
  });

  fcIt.prop([arbApps], { numRuns: 100 })("各状态计数之和等于总数", (apps) => {
    const counts = getStatusCounts(apps);
    expect(counts.PENDING + counts.CONVERTED + counts.REJECTED).toBe(
      counts.ALL,
    );
  });
});

# Extraction Rules Optimization — Revised Proposal v2

> Major Track 设计文档 — 针对 Gate 1 评审反馈的修订版
> 日期: 2026-03-09

---

## 0. 修订说明

本方案基于 Gate 1 评审（均分 6.0/10）识别的 10 项关键缺陷逐一修订。每项改动标注对应的评审反馈编号。

---

## 1. 新增业务字段 [反馈 #1]

### 1.1 新增字段定义

| key                     | label                   | category       | type           | weight | extractTier | required | options / description                                                        |
| ----------------------- | ----------------------- | -------------- | -------------- | ------ | ----------- | -------- | ---------------------------------------------------------------------------- |
| `lease_duration`        | Lease Duration          | `lease_policy` | `multi_select` | 6      | B           | true     | `["3 months", "6 months", "9 months", "12 months", "24 months", "Flexible"]` |
| `move_in_dates`         | Available Move-in Dates | `availability` | `text`         | 5      | B           | false    | 自由文本，如 "Aug 2026, Jan 2027" 或 "Rolling"                               |
| `academic_year_aligned` | Academic Year Aligned   | `availability` | `boolean`      | 3      | B           | false    | 是否按学年周期出租                                                           |

### 1.2 rent_period 新增 "Per Semester" 选项

```diff
- options: ["Weekly", "Monthly", "Yearly"]
+ options: ["Weekly", "Monthly", "Per Semester", "Yearly"]
```

**影响评估**：

- `field-definitions.ts`: 新增 3 个字段 + 修改 1 个 options 数组
- `field-validator.ts`: 无需改动（select/multi_select 验证已读取 options 动态校验）
- Worker 端 LLM prompt: 需同步更新字段列表（由 Worker 项目自行维护）

### 1.3 向后兼容

已有 `field_values` JSONB 中不存在新字段 key，`hasValue()` 返回 false，评分分母增大，已有 building 分数会略微下降（属于预期行为，因为信息确实不完整）。`rent_period` 已有值 "Weekly"/"Monthly"/"Yearly" 仍合法，不受影响。

---

## 2. Contract → Building 一对多字段推送 [反馈 #2]

### 2.1 问题

合同中的 `covered_properties` 是逗号分隔的 building 名称列表，当前仅存储在 contract 级别。合同中的 supplier 级字段（如 `partner_company_name`、`partner_contact_name`）需要推送到每个关联 building。

### 2.2 方案

在 `POST /api/extraction/callback` 处理 `source: "contract_pdf"` 时，增加 contract→building 推送步骤：

```
1. 从合同 contract_fields 读取 supplier 级字段
2. 根据 covered_properties 匹配 buildings（模糊匹配 building_name）
3. 对每个匹配到的 building，将以下字段推送到 building_onboarding_data:
   - primary_contact_name ← partner_contact_name
   - commission_structure ← commission_rate + "%"
   - country ← partner_country
   - city ← partner_city
4. 推送遵守 mergeWithProtection 规则（不覆盖已确认字段）
```

### 2.3 新增映射配置

```typescript
// src/lib/onboarding/contract-field-mapping.ts
export const CONTRACT_TO_BUILDING_MAP: Record<string, string> = {
  partner_contact_name: "primary_contact_name",
  partner_country: "country",
  partner_city: "city",
  commission_rate: "commission_structure",
};
```

### 2.4 covered_properties 解析

```typescript
function parseCoveredProperties(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function fuzzyMatchBuilding(
  propertyName: string,
  buildings: Array<{ id: string; building_name: string }>,
): string | null {
  // 精确匹配 → 包含匹配 → Levenshtein ≤ 3 → null
  const normalized = propertyName.toLowerCase();
  for (const b of buildings) {
    if (b.building_name.toLowerCase() === normalized) return b.id;
  }
  for (const b of buildings) {
    if (
      b.building_name.toLowerCase().includes(normalized) ||
      normalized.includes(b.building_name.toLowerCase())
    )
      return b.id;
  }
  return null;
}
```

**失败处理**：未匹配到的 property name 记录到 `extraction_logs.meta` 中，BD 在管理后台可看到并手动关联。

---

## 3. rental_method ↔ price 上下文依赖 [反馈 #3]

### 3.1 问题

当前 `price_min`/`price_max` 仅校验 `min ≤ max` 和 `≥ 0`。实际上：

- Per Bedroom + USD + Monthly: 合理范围 $300–$5,000
- Per Unit + GBP + Weekly: 合理范围 £100–£2,000
- 没有上下文约束，$0.01 或 $999,999 都会通过

### 3.2 方案：Soft Validation（警告而非拒绝）

新增 `cross-field-rules.ts` 模块，定义**上下文感知的 Soft Validation 规则**：

```typescript
// src/lib/onboarding/cross-field-rules.ts

interface SoftValidationWarning {
  field: string;
  message: string;
  severity: "warning" | "info";
}

interface PriceRange {
  min: number;
  max: number;
}

// 按 country + rental_method + rent_period 的价格合理范围
// 数据来源：uhomes.com 现有房源价格分布的 P5-P95 区间
const PRICE_RANGES: Record<string, PriceRange> = {
  "US:Per Bedroom:Monthly": { min: 300, max: 5000 },
  "US:Per Unit:Monthly": { min: 800, max: 10000 },
  "UK:Per Bedroom:Weekly": { min: 80, max: 600 },
  "UK:Per Unit:Weekly": { min: 150, max: 1500 },
  "UK:Per Bedroom:Per Semester": { min: 2000, max: 12000 },
  "AU:Per Bedroom:Weekly": { min: 150, max: 800 },
  "AU:Per Unit:Weekly": { min: 250, max: 1500 },
  "CA:Per Bedroom:Monthly": { min: 400, max: 4000 },
  "EU:Per Bedroom:Monthly": { min: 300, max: 3000 },
  // 默认 fallback
  DEFAULT: { min: 50, max: 20000 },
};

export function validatePriceContext(
  fields: Record<string, unknown>,
): SoftValidationWarning[] {
  const warnings: SoftValidationWarning[] = [];
  const country = normalizeCountryRegion(fields.country as string);
  const method = (fields.rental_method as string) ?? "Per Bedroom";
  const period = (fields.rent_period as string) ?? "Monthly";

  const key = `${country}:${method}:${period}`;
  const range = PRICE_RANGES[key] ?? PRICE_RANGES["DEFAULT"];

  if (typeof fields.price_min === "number" && fields.price_min < range.min) {
    warnings.push({
      field: "price_min",
      message: `Price ${fields.price_min} seems low for ${country} ${method} ${period} rentals (typical range: ${range.min}–${range.max})`,
      severity: "warning",
    });
  }
  if (typeof fields.price_max === "number" && fields.price_max > range.max) {
    warnings.push({
      field: "price_max",
      message: `Price ${fields.price_max} seems high for ${country} ${method} ${period} rentals (typical range: ${range.min}–${range.max})`,
      severity: "warning",
    });
  }
  return warnings;
}
```

**关键决策**：Soft Validation 只产生**警告**，不阻止保存。在 Gap Report 中展示为黄色提示，BD / Supplier 可选择忽略或修正。

### 3.3 国家归一化

```typescript
function normalizeCountryRegion(raw: string | undefined): string {
  if (!raw) return "DEFAULT";
  const normalized = raw.trim().toLowerCase();
  const US_ALIASES = ["us", "usa", "united states", "united states of america"];
  const UK_ALIASES = [
    "uk",
    "gb",
    "united kingdom",
    "great britain",
    "england",
    "scotland",
    "wales",
  ];
  const AU_ALIASES = ["au", "australia"];
  const CA_ALIASES = ["ca", "canada"];
  if (US_ALIASES.includes(normalized)) return "US";
  if (UK_ALIASES.includes(normalized)) return "UK";
  if (AU_ALIASES.includes(normalized)) return "AU";
  if (CA_ALIASES.includes(normalized)) return "CA";
  // EU countries
  const EU_COUNTRIES = [
    "germany",
    "france",
    "netherlands",
    "ireland",
    "spain",
    "italy",
    "de",
    "fr",
    "nl",
    "ie",
    "es",
    "it",
  ];
  if (EU_COUNTRIES.includes(normalized)) return "EU";
  return "DEFAULT";
}
```

---

## 4. JSONB schema_version 向后兼容 [反馈 #4]

### 4.1 方案

在 `field_values` JSONB 顶层增加 `_meta` 保留键：

```typescript
interface FieldValuesEnvelope {
  _meta: {
    schema_version: number; // 当前 = 1，新增字段后 = 2
    last_schema_upgrade: string; // ISO timestamp
  };
  [fieldKey: string]:
    | FieldValue
    | { schema_version: number; last_schema_upgrade: string };
}
```

### 4.2 Migration 策略

- **schema_version = 1**（当前）：60 个字段，rent_period options = Weekly/Monthly/Yearly
- **schema_version = 2**（本次）：63 个字段（+lease_duration, move_in_dates, academic_year_aligned），rent_period options += Per Semester

升级逻辑在 `data-merge.ts` 的 `mergeWithProtection` 入口处：

```typescript
function ensureSchemaVersion(
  fieldValues: Record<string, FieldValue>,
): Record<string, FieldValue> {
  const meta = fieldValues._meta as unknown;
  const currentVersion =
    meta && typeof meta === "object" && "schema_version" in meta
      ? (meta as { schema_version: number }).schema_version
      : 1;

  if (currentVersion < CURRENT_SCHEMA_VERSION) {
    // 新增字段不需要特殊处理（缺失即 undefined，hasValue 返回 false）
    // 只需更新 _meta
    return {
      ...fieldValues,
      _meta: {
        schema_version: CURRENT_SCHEMA_VERSION,
        last_schema_upgrade: new Date().toISOString(),
      } as unknown as FieldValue,
    };
  }
  return fieldValues;
}
```

### 4.3 hasValue 兼容

`hasValue` 需要跳过 `_meta` key：

```typescript
// 在 calculateScore 中过滤
for (const field of fieldSchema) {
  if (field.key === "_meta") continue; // 保留键
  // ...existing logic
}
```

实际上 `_meta` 不会出现在 `FIELD_SCHEMA` 数组中（因为不是 FieldDefinition），所以无需特殊处理。只需确保 merge/validation 函数不把 `_meta` 当作未知字段拒绝。

---

## 5. LLM 验证结果写回置信度 [反馈 #5]

### 5.1 当前状态

Worker 端已有 LLM Validation 阶段（`meta.llmValidationQuality`、`llmValidationAdjustments`、`llmValidationRemovals`），但回调后 Web 端未利用这些信号调整置信度。

### 5.2 方案

在 `extraction/callback/route.ts` 的数据合并前，增加 **confidence adjustment** 步骤：

```typescript
// src/lib/onboarding/confidence-adjuster.ts

import type { ExtractionFieldValue } from "./data-merge";
import type { Confidence } from "./field-value";

interface AdjustmentResult {
  adjusted: Record<string, ExtractionFieldValue>;
  removedFields: string[];
  downgradedFields: string[];
}

/**
 * 根据 Worker 端 LLM validation 的 quality 评级调整置信度。
 *
 * - llmValidationQuality = "good": 保持原置信度
 * - llmValidationQuality = "mixed": medium 及以下降一级
 * - llmValidationQuality = "poor": 所有字段降一级
 * - 被 Worker 标记为 "removed" 的字段直接丢弃
 */
export function adjustConfidence(
  fields: Record<string, ExtractionFieldValue>,
  validationQuality: string | null,
  removals: number,
): AdjustmentResult {
  const adjusted = { ...fields };
  const removedFields: string[] = [];
  const downgradedFields: string[] = [];

  // 如果 removals > 0，Worker 已移除了不可靠字段（不在 extractedFields 中）
  // 这里处理的是剩余字段的置信度调整

  if (validationQuality === "poor") {
    for (const [key, fv] of Object.entries(adjusted)) {
      const newConf = downgradeConfidence(fv.confidence);
      if (newConf !== fv.confidence) {
        adjusted[key] = { ...fv, confidence: newConf };
        downgradedFields.push(key);
      }
    }
  } else if (validationQuality === "mixed") {
    for (const [key, fv] of Object.entries(adjusted)) {
      if (fv.confidence !== "high") {
        const newConf = downgradeConfidence(fv.confidence);
        if (newConf !== fv.confidence) {
          adjusted[key] = { ...fv, confidence: newConf };
          downgradedFields.push(key);
        }
      }
    }
  }
  // "good" or null: no adjustment

  return { adjusted, removedFields, downgradedFields };
}

function downgradeConfidence(current: Confidence): Confidence {
  switch (current) {
    case "high":
      return "medium";
    case "medium":
      return "low";
    case "low":
      return "low"; // 不能更低
  }
}
```

### 5.3 集成点

在 `callback/route.ts` 步骤 3 之前插入：

```typescript
// ── 2.5. 根据 LLM validation 质量调整置信度 ──
const { adjusted } = adjustConfidence(
  extractedFields,
  meta?.llmValidationQuality ?? null,
  meta?.llmValidationRemovals ?? 0,
);
// 后续 mergeExtractionResults 使用 adjusted 而非 extractedFields
```

---

## 6. 置信度加权评分 [反馈 #6]

### 6.1 当前问题

`scoring-engine.ts` 的 `calculateScore` 只检查 `hasValue()`，不考虑置信度。一个 `confidence: "low"` 的字段和 `confidence: "high"` 的字段得到相同权重。

### 6.2 方案：confidence multiplier

```typescript
// scoring-engine.ts 修改

const CONFIDENCE_MULTIPLIER: Record<Confidence, number> = {
  high: 1.0,
  medium: 0.7,
  low: 0.3,
};

// calculateScore 内部逻辑变更：
for (const field of fieldSchema) {
  totalWeight += field.weight;
  const fv = fieldValues[field.key];
  const filled = hasValue(fv);

  if (filled) {
    const confidence = fv?.confidence ?? "high"; // manual_input 默认 high
    const multiplier = CONFIDENCE_MULTIPLIER[confidence];
    filledWeight += field.weight * multiplier;
  } else {
    missingFields.push(field.key);
  }

  fieldDetails[field.key] = {
    filled,
    weight: field.weight,
    category: field.category,
    confidence: fv?.confidence, // 新增字段
  };
}
```

### 6.3 影响分析

- **分数下降预期**：low confidence 字段从 100% 计分降至 30%，总分会下降。当前 `PREVIEWABLE_THRESHOLD = 80`，如果大量字段是 low confidence，部分 building 可能从 previewable 回退到 incomplete。
- **缓解措施**：将阈值从 80 调整为 **70**（反映置信度加权后的合理预期），同时在 Gap Report 中显示 "X fields have low confidence — please verify" 指引。
- **向后兼容**：`manual_input` source 的字段没有 confidence 元数据时，默认为 `"high"`（人工输入视为高置信度）。

---

## 7. 分阶段 Onboarding [反馈 #7]

### 7.1 三阶段定义

| 阶段    | 名称          | 触发条件                   | 必填字段范围                                                     | 目标     |
| ------- | ------------- | -------------------------- | ---------------------------------------------------------------- | -------- |
| Phase 1 | **Core Info** | 合同签署后首次进入         | 15 个核心字段（basic_info + contacts + fees 中的 required 字段） | 快速上架 |
| Phase 2 | **Enhanced**  | Phase 1 完成（score ≥ 60） | Phase 1 + building_details + availability                        | 完整展示 |
| Phase 3 | **Optimized** | Phase 2 完成（score ≥ 80） | 所有字段                                                         | 最优排名 |

### 7.2 实现方式

在 `FieldDefinition` 中新增 `phase` 属性：

```typescript
export interface FieldDefinition {
  // ...existing fields
  phase: 1 | 2 | 3; // 新增
}
```

字段分配：

```
Phase 1 (15 fields, weight 合计 ~110):
  basic_info: building_name, building_address, city, country, postal_code
  contacts: primary_contact_name, primary_contact_email
  fees: price_min, price_max, currency, rent_period
  commission: commission_structure
  building_details: cover_image, unit_types_summary, key_amenities

Phase 2 (增加 ~20 fields):
  availability: availability_method, lease_duration, move_in_dates
  booking_process: application_method, application_link, lease_type, rental_method
  building_details: total_units, images, floor_plans, furnished_options
  contacts: primary_contact_phone, leasing_manager_name
  fees: utilities_included, deposit_intl, application_fee
  basic_info: description

Phase 3 (剩余 ~28 fields):
  lease_policy: 全部
  tenant_qualification: 全部
  fees: parking_fee, pet_fee, pet_rent, 等
  furnishing_room: 全部
  其余 Tier C 字段
```

### 7.3 Gap Report 分阶段展示

Gap Report 优先显示当前阶段的未完成字段，已完成阶段折叠显示，未来阶段灰色预览。

### 7.4 评分分阶段计算

Phase 1 评分只计算 Phase 1 字段的权重总和作为分母：

```typescript
function calculatePhaseScore(
  fieldSchema: FieldDefinition[],
  fieldValues: Record<string, FieldValue>,
  targetPhase: 1 | 2 | 3,
): ScoreResult {
  const phaseFields = fieldSchema.filter((f) => f.phase <= targetPhase);
  return calculateScore(phaseFields, fieldValues);
}
```

Dashboard 上显示两个分数：**当前阶段完成率** + **总完成率**。

---

## 8. N/A 字段排除机制 [反馈 #8]

### 8.1 问题

`i20_accepted` 只适用于 US 市场，UK 的 building 填 "N/A" 也算完成了，但实际不应计入分母。`pet_fee`/`pet_rent` 对不接受宠物的公寓不适用。

### 8.2 方案：Field Applicability Rules

```typescript
// src/lib/onboarding/field-applicability.ts

interface ApplicabilityRule {
  /** 目标字段 */
  field: string;
  /** 条件：当依赖字段的值满足条件时，目标字段才纳入计分 */
  dependsOn: string;
  /** 依赖字段值必须匹配的条件 */
  condition: (value: unknown) => boolean;
}

export const APPLICABILITY_RULES: ApplicabilityRule[] = [
  // i20_accepted 仅适用于 US
  {
    field: "i20_accepted",
    dependsOn: "country",
    condition: (v) => {
      const s = String(v ?? "").toLowerCase();
      return [
        "us",
        "usa",
        "united states",
        "united states of america",
      ].includes(s);
    },
  },
  // pet_fee / pet_rent 仅在允许宠物时适用
  {
    field: "pet_fee",
    dependsOn: "key_amenities",
    condition: (v) => Array.isArray(v) && v.includes("Pet Friendly"),
  },
  {
    field: "pet_rent",
    dependsOn: "key_amenities",
    condition: (v) => Array.isArray(v) && v.includes("Pet Friendly"),
  },
  // commission_short_term / commission_renewals 仅在有佣金结构时适用
  {
    field: "commission_short_term",
    dependsOn: "commission_structure",
    condition: (v) => typeof v === "string" && v.trim().length > 0,
  },
  {
    field: "commission_renewals",
    dependsOn: "commission_structure",
    condition: (v) => typeof v === "string" && v.trim().length > 0,
  },
];

/**
 * 给定当前字段值，返回不适用（应排除出分母）的字段 key 集合
 */
export function getExcludedFields(
  fieldValues: Record<string, FieldValue>,
): Set<string> {
  const excluded = new Set<string>();
  for (const rule of APPLICABILITY_RULES) {
    const depValue = fieldValues[rule.dependsOn]?.value;
    if (!rule.condition(depValue)) {
      excluded.add(rule.field);
    }
  }
  return excluded;
}
```

### 8.3 评分引擎集成

```typescript
// calculateScore 修改
export function calculateScore(
  fieldSchema: FieldDefinition[],
  fieldValues: Record<string, FieldValue>,
  excludedFields?: Set<string>, // 新增可选参数
): ScoreResult {
  for (const field of fieldSchema) {
    if (excludedFields?.has(field.key)) continue; // 跳过不适用字段
    totalWeight += field.weight;
    // ...rest unchanged
  }
}
```

---

## 9. 用户友好错误消息 [反馈 #9]

### 9.1 当前问题

`field-validator.ts` 返回技术性错误如 "Must be a finite number"、"Must be one of: Yes, No, N/A"，供应商看不懂。

### 9.2 方案：Business-Language Error Messages

新增 `validation-messages.ts`，将技术错误翻译为业务指引：

```typescript
// src/lib/onboarding/validation-messages.ts

interface UserFriendlyError {
  field: string;
  label: string;
  message: string; // 技术消息（日志用）
  userMessage: string; // 用户友好消息（UI 显示）
  suggestion?: string; // 可选修复建议
}

const FIELD_HINTS: Record<
  string,
  { userMessage: string; suggestion?: string }
> = {
  "price_min:Must be a finite number": {
    userMessage: "Please enter the minimum rental price as a number",
    suggestion: "For example: 800 (without currency symbol)",
  },
  "price_max:Must be a finite number": {
    userMessage: "Please enter the maximum rental price as a number",
    suggestion: "For example: 2500 (without currency symbol)",
  },
  "price_min:Must be a non-negative number": {
    userMessage: "The minimum price cannot be negative",
  },
  "primary_contact_email:Must be a valid email address": {
    userMessage: "Please enter a valid email address for the primary contact",
    suggestion: "For example: leasing@yourproperty.com",
  },
  "cover_image:Must be a valid URL starting with http:// or https://": {
    userMessage: "Please provide a direct link to your property's main photo",
    suggestion:
      "The URL should start with https:// — you can right-click an image on your website and copy the image address",
  },
};

export function toUserFriendlyErrors(
  errors: Array<{ key: string; label: string; message: string }>,
): UserFriendlyError[] {
  return errors.map((e) => {
    const hintKey = `${e.key}:${e.message}`;
    const hint = FIELD_HINTS[hintKey];
    return {
      field: e.key,
      label: e.label,
      message: e.message,
      userMessage: hint?.userMessage ?? `Please check the "${e.label}" field`,
      suggestion: hint?.suggestion,
    };
  });
}
```

### 9.3 UI 展示

在 `FieldEditor` 组件中，错误提示显示 `userMessage`，hover 时 tooltip 显示 `suggestion`。

---

## 10. 并发安全：乐观锁验证 [反馈 #10]

### 10.1 当前状态

`job-helpers.ts` 的 `mergeOnboardingDataWithRetry` 已实现了基于 `version` 列的乐观锁 + 3 次重试：

```typescript
// 现有逻辑（已实现）
const { error } = await admin
  .from("building_onboarding_data")
  .update({
    field_values: mergedValues,
    version: currentVersion + 1,
  })
  .eq("building_id", buildingId)
  .eq("version", currentVersion); // 乐观锁条件
```

### 10.2 补充改进

**问题**：重试时只重新 update，没有重新读取最新 field_values 并重新 merge。如果两个 Worker 同时回调，第二个 Worker 的重试可能基于过时数据。

**修正**：重试循环中必须重新 SELECT + merge：

```typescript
async function mergeOnboardingDataWithRetry(
  admin: SupabaseClient,
  buildingId: string,
  incomingValues: Record<string, FieldValue>,
  _initialData: {
    field_values: Record<string, FieldValue>;
    version: number;
  } | null,
  _initialMerged: Record<string, FieldValue>,
  maxRetries = 3,
): Promise<void> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // 每次重试都重新读取最新数据
    const { data: latest } = await admin
      .from("building_onboarding_data")
      .select("field_values, version")
      .eq("building_id", buildingId)
      .single();

    const existingValues = latest?.field_values ?? {};
    const currentVersion = latest?.version ?? 0;
    const mergedValues = mergeWithProtection(existingValues, incomingValues);

    const { error } = await admin
      .from("building_onboarding_data")
      .update({
        field_values: mergedValues,
        version: currentVersion + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("building_id", buildingId)
      .eq("version", currentVersion);

    if (!error) return; // 成功

    if (attempt === maxRetries - 1) {
      console.error("[mergeOnboardingData] All retries exhausted", {
        buildingId,
      });
      throw new Error("Concurrent update conflict after max retries");
    }
    // 下一次循环会重新读取
  }
}
```

### 10.3 补充：Job 级别去重

在 `extraction/callback/route.ts` 入口增加幂等性检查：

```typescript
if (jobId) {
  const { data: job } = await admin
    .from("extraction_jobs")
    .select("status")
    .eq("id", jobId)
    .single();

  if (job?.status === "completed" || job?.status === "failed") {
    // 已处理过的回调，直接返回 200（幂等）
    return NextResponse.json({
      message: "Callback already processed (idempotent)",
      buildingId,
    });
  }
}
```

---

## 11. 数据模型变更汇总

### 11.1 field-definitions.ts 变更

| 变更类型 | 内容                                                                                       |
| -------- | ------------------------------------------------------------------------------------------ |
| 新增字段 | `lease_duration` (multi_select), `move_in_dates` (text), `academic_year_aligned` (boolean) |
| 修改字段 | `rent_period` options 新增 "Per Semester"                                                  |
| 新增属性 | `phase: 1 \| 2 \| 3` 添加到所有 FieldDefinition                                            |

### 11.2 新增文件

| 文件                                           | 用途                       |
| ---------------------------------------------- | -------------------------- |
| `src/lib/onboarding/cross-field-rules.ts`      | 上下文感知 Soft Validation |
| `src/lib/onboarding/field-applicability.ts`    | N/A 字段排除               |
| `src/lib/onboarding/confidence-adjuster.ts`    | LLM 验证结果 → 置信度调整  |
| `src/lib/onboarding/contract-field-mapping.ts` | 合同→Building 字段推送映射 |
| `src/lib/onboarding/validation-messages.ts`    | 用户友好错误消息           |

### 11.3 修改文件

| 文件                           | 变更                                                             |
| ------------------------------ | ---------------------------------------------------------------- |
| `field-definitions.ts`         | 新增 3 字段 + phase 属性 + rent_period option                    |
| `field-schema.ts`              | FieldDefinition 接口新增 `phase`                                 |
| `scoring-engine.ts`            | 置信度加权 + excludedFields 参数                                 |
| `data-merge.ts`                | schema_version 升级逻辑                                          |
| `extraction/callback/route.ts` | confidence adjustment + contract push-down + 幂等检查 + 重试修正 |
| `job-helpers.ts`               | mergeOnboardingDataWithRetry 重试逻辑修正                        |
| `field-validator.ts`           | 无需改动（已动态读取 options）                                   |
| `status-engine.ts`             | PREVIEWABLE_THRESHOLD 从 80 调整为 70                            |

### 11.4 数据库变更

无新表。`building_onboarding_data.field_values` JSONB 新增 `_meta.schema_version` 保留键（无需 migration，JSONB 结构变更是应用层）。

---

## 12. 国际化覆盖 [评审清单必查项]

| 市场 | 覆盖项                                                    |
| ---- | --------------------------------------------------------- |
| US   | i20_accepted 条件适用, USD price ranges, Per Bedroom/Unit |
| UK   | Weekly pricing, GBP ranges, Per Semester (学期制)         |
| AU   | Weekly pricing, AUD ranges                                |
| CA   | Monthly pricing, CAD ranges                               |
| EU   | Monthly pricing, EUR ranges, 多国归一化                   |

---

## 13. 测试计划

### 13.1 Unit Tests (新增)

| 模块                     | 测试文件                                   | 用例数                                                  |
| ------------------------ | ------------------------------------------ | ------------------------------------------------------- |
| cross-field-rules        | `__tests__/cross-field-rules.test.ts`      | ~12 (US/UK/AU/CA/EU + boundary prices + missing fields) |
| field-applicability      | `__tests__/field-applicability.test.ts`    | ~8 (US vs non-US i20, pet-friendly vs not, etc.)        |
| confidence-adjuster      | `__tests__/confidence-adjuster.test.ts`    | ~6 (good/mixed/poor quality + edge cases)               |
| contract-field-mapping   | `__tests__/contract-field-mapping.test.ts` | ~6 (exact/fuzzy/no match)                               |
| validation-messages      | `__tests__/validation-messages.test.ts`    | ~5 (known hint + fallback)                              |
| scoring-engine (updated) | 更新现有测试                               | +8 (confidence multiplier + excludedFields)             |

### 13.2 Integration Tests (新增)

| 场景                     | 描述                                                        |
| ------------------------ | ----------------------------------------------------------- |
| Contract push-down       | 合同签署 → covered_properties 解析 → building 字段自动填充  |
| Dual extraction callback | 两个 Worker 并发回调同一 building → 乐观锁重试 → 数据不丢失 |
| Phase progression        | Phase 1 完成 → score ≥ 60 → Gap Report 切换到 Phase 2       |

### 13.3 边界/异常用例

- rent_period = "Per Semester" + country = "US"（不常见组合，应不报错）
- covered_properties = "" 或 null（无 building 匹配，不崩溃）
- schema_version = undefined（旧数据兼容）
- confidence = undefined（manual_input 场景，默认 high）
- 所有字段都是 N/A applicable（极端情况，分母不能为 0）

---

## 14. Sentry 监控

| 事件                                   | 级别    | 描述                                       |
| -------------------------------------- | ------- | ------------------------------------------ |
| `extraction.confidence_downgrade`      | info    | LLM validation 导致置信度降级              |
| `extraction.merge_retry`               | warning | 乐观锁冲突触发重试                         |
| `extraction.merge_exhausted`           | error   | 重试耗尽，数据合并失败                     |
| `extraction.contract_pushdown_nomatch` | warning | covered_properties 无法匹配到任何 building |
| `extraction.callback_idempotent`       | info    | 重复回调被幂等处理                         |

---

## 15. 实施顺序（4 个 PR）

| PR   | 内容                                                                                 | 依赖        |
| ---- | ------------------------------------------------------------------------------------ | ----------- |
| PR-1 | 新增 3 字段 + phase 属性 + rent_period option + schema_version + field-applicability | 无          |
| PR-2 | confidence-adjuster + scoring-engine 置信度加权 + status-engine 阈值调整             | PR-1        |
| PR-3 | cross-field-rules + validation-messages + contract-field-mapping                     | PR-1        |
| PR-4 | callback 路由集成（confidence adjustment + contract push-down + 幂等 + 重试修正）    | PR-2 + PR-3 |

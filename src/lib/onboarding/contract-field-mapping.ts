/**
 * Contract Field Mapping — 合同字段→Building 字段的映射配置。
 *
 * 合同签署后，supplier 级字段（partner_contact_name 等）
 * 需要推送到每个关联 building 的 onboarding_data 中。
 */

/** 合同 contract_fields key → building field_values key */
export const CONTRACT_TO_BUILDING_MAP: Record<string, string> = {
  partner_contact_name: "primary_contact_name",
  partner_country: "country",
  partner_city: "city",
  commission_rate: "commission_structure",
};

/**
 * 解析 covered_properties 字符串为 building 名称列表。
 * 支持逗号、分号、换行分隔。
 */
export function parseCoveredProperties(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 模糊匹配 building 名称。
 * 匹配顺序：精确 → 包含（双向）→ null
 * 最小长度 4 字符以避免短名称误匹配。
 */
export function fuzzyMatchBuilding(
  propertyName: string,
  buildings: Array<{ id: string; building_name: string }>,
): string | null {
  const normalized = propertyName.toLowerCase().trim();
  if (normalized.length < 4) return null;

  for (const b of buildings) {
    if (b.building_name.toLowerCase().trim() === normalized) return b.id;
  }
  for (const b of buildings) {
    const bn = b.building_name.toLowerCase().trim();
    if (bn.includes(normalized) || normalized.includes(bn)) return b.id;
  }
  return null;
}

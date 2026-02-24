import {
  type ContractFields,
  CONTRACT_FIELD_KEYS,
} from "@/lib/contracts/types";

/** DocuSign Text Tab 结构，对应模板中的 tabLabel 占位符 */
export interface DocuSignTextTab {
  tabLabel: string;
  value: string;
}

/**
 * 将合同动态字段转换为 DocuSign Text Tabs 数组。
 *
 * 每个 ContractFields 键映射为一个 Text Tab，
 * tabLabel 与字段名一致，value 为字段值。
 *
 * @param fields - 合同动态字段对象
 * @returns DocuSign Text Tabs 数组（长度固定为 9，与 CONTRACT_FIELD_KEYS 一一对应）
 */
export function buildTextTabs(fields: ContractFields): DocuSignTextTab[] {
  return CONTRACT_FIELD_KEYS.map((key) => ({
    tabLabel: key,
    value: fields[key],
  }));
}

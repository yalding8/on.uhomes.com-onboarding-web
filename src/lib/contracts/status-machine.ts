/**
 * 合同状态机 — 纯函数实现，无副作用
 *
 * 合法状态流转路径：
 *   DRAFT → PENDING_REVIEW → CONFIRMED → SENT → SIGNED
 *   DRAFT / PENDING_REVIEW / CONFIRMED → CANCELED
 *
 * SIGNED 和 CANCELED 为终态，不可再转换。
 */

import type { ContractStatus } from "./types";

/**
 * 合法状态转换映射表
 * key: 当前状态，value: 该状态可转换到的目标状态列表
 */
export const VALID_TRANSITIONS: Readonly<
  Record<ContractStatus, readonly ContractStatus[]>
> = {
  DRAFT: ["PENDING_REVIEW", "CANCELED"],
  PENDING_REVIEW: ["CONFIRMED", "DRAFT", "CANCELED"],
  CONFIRMED: ["SENT", "CANCELED"],
  SENT: ["SIGNED"],
  SIGNED: [],
  CANCELED: [],
} as const;

/**
 * 判断从 `from` 状态到 `to` 状态的转换是否合法
 */
export function canTransition(
  from: ContractStatus,
  to: ContractStatus,
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/**
 * 验证状态转换，返回结构化结果
 * - 合法转换返回 `{ valid: true }`
 * - 非法转换返回 `{ valid: false, reason: string }`
 */
export function validateTransition(
  from: ContractStatus,
  to: ContractStatus,
): { valid: true } | { valid: false; reason: string } {
  if (from === to) {
    return { valid: false, reason: `状态未变更，当前已是 ${from}` };
  }

  if (canTransition(from, to)) {
    return { valid: true };
  }

  const allowed = VALID_TRANSITIONS[from];
  if (allowed.length === 0) {
    return {
      valid: false,
      reason: `${from} 为终态，不可转换到任何其他状态`,
    };
  }

  return {
    valid: false,
    reason: `不允许从 ${from} 转换到 ${to}，合法目标状态为: ${allowed.join(", ")}`,
  };
}

/**
 * 判断合同在给定状态下是否可编辑
 * 仅 DRAFT 状态允许编辑合同字段
 */
export function isEditable(status: ContractStatus): boolean {
  return status === "DRAFT";
}

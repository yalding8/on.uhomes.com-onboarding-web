/**
 * Status Engine — 基于 Quality Score 阈值驱动 Building 状态转换。
 *
 * 状态流: extracting → incomplete → previewable → ready_to_publish → published
 * 阈值规则:
 *   - score < 80 → incomplete（如果当前是 previewable 则回退）
 *   - score >= 80 → previewable（如果当前是 incomplete 则升级）
 *   - ready_to_publish / published 由用户操作触发，不受评分自动影响
 */

export type BuildingStatus =
  | 'extracting'
  | 'incomplete'
  | 'previewable'
  | 'ready_to_publish'
  | 'published';

const PREVIEWABLE_THRESHOLD = 80;

/** 不受评分自动影响的终态 */
const LOCKED_STATUSES: BuildingStatus[] = ['ready_to_publish', 'published', 'extracting'];

export function resolveStatus(
  currentStatus: BuildingStatus,
  oldScore: number,
  newScore: number,
): BuildingStatus {
  // 终态不受评分变化影响
  if (LOCKED_STATUSES.includes(currentStatus)) {
    return currentStatus;
  }

  // 从低于阈值升到达标 → previewable
  if (oldScore < PREVIEWABLE_THRESHOLD && newScore >= PREVIEWABLE_THRESHOLD) {
    return 'previewable';
  }

  // 从达标降到低于阈值 → incomplete
  if (oldScore >= PREVIEWABLE_THRESHOLD && newScore < PREVIEWABLE_THRESHOLD) {
    return 'incomplete';
  }

  // 如果当前是 previewable 但新分数低于阈值（边界保护）
  if (currentStatus === 'previewable' && newScore < PREVIEWABLE_THRESHOLD) {
    return 'incomplete';
  }

  // 如果当前是 incomplete 但新分数达标（边界保护）
  if (currentStatus === 'incomplete' && newScore >= PREVIEWABLE_THRESHOLD) {
    return 'previewable';
  }

  return currentStatus;
}

export { PREVIEWABLE_THRESHOLD };

/**
 * 活跃任务计数器 — 用于优雅关闭时等待进行中任务完成
 */

let activeJobs = 0;

export function trackJobStart(): void {
  activeJobs++;
}

export function trackJobEnd(): void {
  activeJobs--;
}

export function getActiveJobCount(): number {
  return activeJobs;
}

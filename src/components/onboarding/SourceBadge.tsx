/**
 * SourceBadge — 数据来源标签。
 * 展示字段值的来源：合同 / 网站 / Sheets / 手动。
 */

import type { DataSource } from '@/lib/onboarding/field-value';

const SOURCE_CONFIG: Record<DataSource, { label: string; color: string }> = {
  contract_pdf: { label: '合同', color: 'var(--color-primary)' },
  website_crawl: { label: '网站', color: 'var(--color-warning)' },
  google_sheets: { label: 'Sheets', color: 'var(--color-success)' },
  manual_input: { label: '手动', color: 'var(--color-text-muted)' },
};

interface SourceBadgeProps {
  source: DataSource;
}

export function SourceBadge({ source }: SourceBadgeProps) {
  const cfg = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.manual_input;

  return (
    <span
      className="inline-flex items-center text-xs px-1.5 py-0.5 rounded"
      style={{
        color: cfg.color,
        backgroundColor: 'var(--color-bg-secondary)',
        border: `1px solid var(--color-border)`,
      }}
    >
      {cfg.label}
    </span>
  );
}

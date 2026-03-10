/**
 * SourceBadge — 数据来源标签。
 * 展示字段值的来源：合同 / 网站 / Sheets / 手动。
 */

import type { DataSource } from "@/lib/onboarding/field-value";

const SOURCE_CONFIG: Record<DataSource, { label: string; color: string }> = {
  contract_pdf: { label: "Contract", color: "var(--color-primary)" },
  website_crawl: { label: "Website", color: "var(--color-warning)" },
  google_sheets: { label: "Sheets", color: "var(--color-success)" },
  file_upload: { label: "Upload", color: "var(--color-info)" },
  dropbox: { label: "Dropbox", color: "var(--color-info)" },
  api_doc: { label: "API", color: "var(--color-info)" },
  manual_input: { label: "Manual", color: "var(--color-text-muted)" },
};

interface SourceBadgeProps {
  source: DataSource;
}

export function SourceBadge({ source }: SourceBadgeProps) {
  const cfg = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.manual_input;

  return (
    <span
      className="inline-flex items-center text-xs px-1.5 py-0.5 rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
      style={{ color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

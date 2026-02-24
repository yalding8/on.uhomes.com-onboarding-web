/**
 * 供应商详情页 — 类型定义与状态配置
 */

export interface BuildingInfo {
  id: string;
  building_name: string;
  building_address: string | null;
  onboarding_status: string | null;
  score: number | null;
}

export interface ContractInfo {
  id: string;
  status: string;
  embedded_signing_url: string | null;
  document_url: string | null;
  created_at: string;
}

export interface SupplierDetail {
  id: string;
  company_name: string;
  contact_email: string;
  role: string;
  status: string;
  created_at: string;
}

/** Contract status labels */
export const CONTRACT_STATUS_LABELS: Record<
  string,
  { label: string; className: string }
> = {
  DRAFT: {
    label: "Draft",
    className:
      "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]",
  },
  PENDING_REVIEW: {
    label: "Pending Review",
    className: "bg-[var(--color-warning-light)] text-[var(--color-warning)]",
  },
  CONFIRMED: {
    label: "Confirmed",
    className: "bg-[var(--color-primary-light)] text-[var(--color-primary)]",
  },
  SENT: {
    label: "Sent",
    className: "bg-[var(--color-primary-light)] text-[var(--color-primary)]",
  },
  SIGNED: {
    label: "Signed",
    className: "bg-[var(--color-success-light)] text-[var(--color-success)]",
  },
  CANCELED: {
    label: "Canceled",
    className: "bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]",
  },
};

export const SUPPLIER_STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  NEW: {
    label: "New",
    className:
      "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]",
  },
  PENDING_CONTRACT: {
    label: "Pending Contract",
    className: "bg-[var(--color-warning-light)] text-[var(--color-warning)]",
  },
  SIGNED: {
    label: "Signed",
    className: "bg-[var(--color-success-light)] text-[var(--color-success)]",
  },
};

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

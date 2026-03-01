export type SupplierStep =
  | "applied"
  | "under_review"
  | "sign_contract"
  | "setup_properties";

export interface StepConfig {
  key: SupplierStep;
  label: string;
  shortLabel: string;
}

export const SUPPLIER_STEPS: readonly StepConfig[] = [
  { key: "applied", label: "Applied", shortLabel: "Applied" },
  { key: "under_review", label: "Under Review", shortLabel: "Review" },
  { key: "sign_contract", label: "Sign Contract", shortLabel: "Contract" },
  { key: "setup_properties", label: "Setup Properties", shortLabel: "Setup" },
] as const;

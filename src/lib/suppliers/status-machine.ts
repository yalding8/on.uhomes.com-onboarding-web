/**
 * Supplier Status State Machine
 *
 * States:
 *   NEW               — Initial state after application approval
 *   PENDING_CONTRACT   — Supplier created, awaiting contract completion
 *   SIGNED             — Contract signed, fully onboarded
 *   DELETION_PENDING   — Account deletion requested, 30-day cooling period
 *   DELETED            — AU-only: anonymized record (Privacy Act 1988)
 *
 * Transitions:
 *   NEW               → PENDING_CONTRACT  (application approved)
 *   PENDING_CONTRACT   → SIGNED           (contract signed via DocuSign)
 *   PENDING_CONTRACT   → DELETION_PENDING (supplier requests deletion)
 *   SIGNED             → DELETION_PENDING (supplier requests deletion)
 *   DELETION_PENDING   → SIGNED           (supplier cancels deletion)
 *   DELETION_PENDING   → DELETED          (cooling period expires, AU only)
 *   DELETION_PENDING   → (removed)        (cooling period expires, non-AU)
 */

export type SupplierStatus =
  | "NEW"
  | "PENDING_CONTRACT"
  | "SIGNED"
  | "DELETION_PENDING"
  | "DELETED";

const VALID_TRANSITIONS: Record<SupplierStatus, SupplierStatus[]> = {
  NEW: ["PENDING_CONTRACT"],
  PENDING_CONTRACT: ["SIGNED", "DELETION_PENDING"],
  SIGNED: ["DELETION_PENDING"],
  DELETION_PENDING: ["SIGNED", "DELETED"],
  DELETED: [],
};

export function canTransition(
  from: SupplierStatus,
  to: SupplierStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validateSupplierTransition(
  from: SupplierStatus,
  to: SupplierStatus,
): { valid: boolean; reason?: string } {
  if (from === to) {
    return { valid: false, reason: `Status unchanged, already ${from}` };
  }

  if (VALID_TRANSITIONS[from]?.length === 0) {
    return { valid: false, reason: `${from} is a terminal state` };
  }

  if (!canTransition(from, to)) {
    const allowed = VALID_TRANSITIONS[from] ?? [];
    return {
      valid: false,
      reason: `Cannot transition from ${from} to ${to}. Allowed: ${allowed.join(", ") || "none"}`,
    };
  }

  return { valid: true };
}

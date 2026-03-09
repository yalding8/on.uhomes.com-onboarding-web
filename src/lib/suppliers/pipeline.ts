/**
 * Supplier Pipeline stage computation.
 *
 * Derives a business-meaningful pipeline stage from supplier status,
 * contract status, and building onboarding statuses.
 */

export type PipelineStage =
  | "NEW_CONTRACT"
  | "CONTRACT_IN_PROGRESS"
  | "AWAITING_SIGNATURE"
  | "SIGNED"
  | "LIVE";

export const PIPELINE_STAGES: {
  value: PipelineStage;
  label: string;
  color: string;
}[] = [
  {
    value: "NEW_CONTRACT",
    label: "New",
    color: "var(--color-text-muted)",
  },
  {
    value: "CONTRACT_IN_PROGRESS",
    label: "In Progress",
    color: "var(--color-primary)",
  },
  {
    value: "AWAITING_SIGNATURE",
    label: "Awaiting Signature",
    color: "var(--color-warning)",
  },
  {
    value: "SIGNED",
    label: "Signed",
    color: "var(--color-success)",
  },
  {
    value: "LIVE",
    label: "Live",
    color: "var(--color-success)",
  },
];

export function computePipelineStage(
  supplierStatus: string,
  contractStatus: string | null,
  buildings: { onboarding_status: string }[],
): PipelineStage {
  if (supplierStatus === "SIGNED") {
    const hasPublished = buildings.some(
      (b) => b.onboarding_status === "published",
    );
    return hasPublished ? "LIVE" : "SIGNED";
  }
  if (!contractStatus) return "NEW_CONTRACT";
  if (contractStatus === "SENT") return "AWAITING_SIGNATURE";
  return "CONTRACT_IN_PROGRESS";
}

export function getNextAction(
  stage: PipelineStage,
  contractStatus: string | null,
  buildings: { onboarding_status: string; score: number }[],
): { text: string; actionType?: "copy_email" | "link" } {
  switch (stage) {
    case "NEW_CONTRACT":
      return { text: "Create contract for this supplier" };
    case "CONTRACT_IN_PROGRESS":
      if (contractStatus === "DRAFT")
        return { text: "Complete contract editing" };
      if (contractStatus === "PENDING_REVIEW")
        return { text: "Review and confirm contract" };
      if (contractStatus === "CONFIRMED")
        return { text: "Send contract to supplier" };
      return { text: "Process contract" };
    case "AWAITING_SIGNATURE":
      return {
        text: "Follow up with supplier to sign contract",
        actionType: "copy_email",
      };
    case "SIGNED": {
      const incomplete = buildings.filter(
        (b) => b.onboarding_status === "incomplete",
      );
      if (incomplete.length > 0)
        return { text: `${incomplete.length} building(s) need more data` };
      const reviewable = buildings.filter(
        (b) =>
          b.onboarding_status === "previewable" ||
          b.onboarding_status === "ready_to_publish",
      );
      if (reviewable.length > 0)
        return { text: `${reviewable.length} building(s) ready for review` };
      return { text: "Monitor onboarding progress" };
    }
    case "LIVE":
      return { text: "All buildings published — operational maintenance" };
  }
}

/**
 * Compute days in current pipeline stage from available timestamps.
 */
export function computeStageDays(
  stage: PipelineStage,
  supplierCreatedAt: string,
  contractCreatedAt: string | null,
  contractUpdatedAt: string | null,
  contractSignedAt: string | null,
): number {
  const now = Date.now();
  let startMs: number;

  switch (stage) {
    case "NEW_CONTRACT":
      startMs = new Date(supplierCreatedAt).getTime();
      break;
    case "CONTRACT_IN_PROGRESS":
      startMs = new Date(contractCreatedAt ?? supplierCreatedAt).getTime();
      break;
    case "AWAITING_SIGNATURE":
      startMs = new Date(contractUpdatedAt ?? supplierCreatedAt).getTime();
      break;
    case "SIGNED":
      startMs = new Date(
        contractSignedAt ?? contractUpdatedAt ?? supplierCreatedAt,
      ).getTime();
      break;
    case "LIVE":
      return 0; // Don't show days for LIVE stage
  }

  return Math.max(0, Math.floor((now - startMs) / (1000 * 60 * 60 * 24)));
}

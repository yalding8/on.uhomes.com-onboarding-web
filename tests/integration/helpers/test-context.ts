/**
 * TestContext — shared state across Agent A pipeline phases.
 * Each field is populated sequentially as the pipeline progresses.
 */

export interface TestContext {
  runId: string;
  baseUrl: string;

  // Phase 1: Application
  applicationId?: string;

  // Phase 2: Approval
  supplierId?: string;
  supplierUserId?: string;
  supplierEmail?: string;
  contractId?: string;

  // Phase 2.2: Direct invite
  inviteSupplierId?: string;
  inviteSupplierEmail?: string;

  // Phase 3: Contract
  contractFields?: Record<string, unknown>;

  // Phase 4: Signing
  envelopeId?: string;

  // Phase 5: Extraction
  buildingId?: string;
  extractionJobIds?: string[];

  // Phase 6: Onboarding
  onboardingVersion?: number;
}

export function createTestContext(): TestContext {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return {
    runId: `TEST_${ts}_${rand}`,
    baseUrl: process.env.INTEGRATION_BASE_URL || "http://localhost:3100",
  };
}

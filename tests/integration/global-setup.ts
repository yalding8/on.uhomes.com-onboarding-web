/**
 * Global setup for integration tests.
 * Validates dev server and Supabase connectivity before running any test.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

/** Minimal .env parser — no external dependency needed */
function loadEnvFile(filePath: string): void {
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return; // File doesn't exist, skip
  }
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

export default async function globalSetup(): Promise<void> {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  loadEnvFile(resolve(process.cwd(), ".env"));

  const baseUrl = process.env.INTEGRATION_BASE_URL || "http://localhost:3100";

  // 1. Verify dev server is running
  try {
    const res = await fetch(baseUrl, {
      signal: AbortSignal.timeout(5_000),
      redirect: "manual",
    });
    if (!res.ok && res.status >= 500) {
      throw new Error(`Dev server returned ${res.status}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Dev server not reachable at ${baseUrl}. Run "npm run dev" first.\n${msg}`,
    );
  }

  // 2. Verify Supabase env vars
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Missing env vars for integration tests: ${missing.join(", ")}`,
    );
  }

  // 3. Verify Supabase connectivity
  const { createAdminClient } = await import("./helpers/admin-client");
  const admin = createAdminClient();
  const { error } = await admin.from("applications").select("id").limit(1);
  if (error) {
    throw new Error(`Supabase connectivity check failed: ${error.message}`);
  }
}

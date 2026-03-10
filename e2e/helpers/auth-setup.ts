/**
 * Playwright globalSetup: authenticate via Supabase admin magic link,
 * then save storageState for reuse in authenticated test suites.
 *
 * Creates two auth states:
 *   - BD (admin) — auto-provisioned @uhomes.com email
 *   - Supplier — with SIGNED status for full access
 */

import { chromium, type FullConfig } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load env from project root
dotenv.config({
  path: path.resolve(__dirname, "../../.env.local"),
});
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const BD_EMAIL = process.env.E2E_BD_EMAIL ?? "e2e-bd-test@uhomes.com";
const SUPPLIER_EMAIL =
  process.env.E2E_SUPPLIER_EMAIL ?? "e2e-supplier-test@example.com";

const AUTH_DIR = path.resolve(__dirname, "../.auth");
export const BD_STATE = path.join(AUTH_DIR, "bd.json");
export const SUPPLIER_STATE = path.join(AUTH_DIR, "supplier.json");

function extractProjectRef(url: string): string {
  const match = url.match(/\/\/([^.]+)\./);
  return match?.[1] ?? "localhost";
}

function buildAuthCookies(session: {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in: number;
  token_type: string;
}): Array<{
  name: string;
  value: string;
  domain: string;
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Lax";
}> {
  const ref = extractProjectRef(SUPABASE_URL);
  const baseName = `sb-${ref}-auth-token`;
  const payload = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
  });

  const MAX_CHUNK = 3500;
  const chunks: Array<{ name: string; value: string }> = [];
  if (payload.length <= MAX_CHUNK) {
    chunks.push({ name: `${baseName}.0`, value: payload });
  } else {
    for (let i = 0; i < payload.length; i += MAX_CHUNK) {
      chunks.push({
        name: `${baseName}.${chunks.length}`,
        value: payload.slice(i, i + MAX_CHUNK),
      });
    }
  }

  return chunks.map((c) => ({
    name: c.name,
    value: encodeURIComponent(c.value),
    domain: "localhost",
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax" as const,
  }));
}

async function getSession(email: string) {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: linkData, error: linkErr } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

  if (linkErr || !linkData) {
    throw new Error(
      `generateLink failed for ${email}: ${linkErr?.message ?? "no data"}`,
    );
  }

  const tokenHash = linkData.properties?.hashed_token;
  if (!tokenHash) {
    throw new Error(`No hashed_token for ${email}`);
  }

  const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error: verifyErr } = await anonClient.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });

  if (verifyErr || !data.session) {
    throw new Error(
      `verifyOtp failed for ${email}: ${verifyErr?.message ?? "no session"}`,
    );
  }

  return data.session;
}

async function saveAuthState(
  email: string,
  outputPath: string,
  config: FullConfig,
) {
  const session = await getSession(email);
  const cookies = buildAuthCookies(session);

  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:3000";

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });

  // Set cookies into browser context
  await context.addCookies(cookies);

  // Navigate to trigger middleware (session hydration)
  const page = await context.newPage();
  try {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 15000 });
  } catch {
    // Redirect is expected — just need cookies set
  }

  await context.storageState({ path: outputPath });
  await browser.close();
}

export default async function globalSetup(config: FullConfig) {
  // Skip if env vars missing (allows running public-only tests)
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    console.warn("[e2e auth] Missing Supabase env vars — skipping auth setup.");
    console.warn("[e2e auth] Authenticated test suites will be skipped.");
    return;
  }

  fs.mkdirSync(AUTH_DIR, { recursive: true });

  console.log("[e2e auth] Setting up BD auth state...");
  try {
    await saveAuthState(BD_EMAIL, BD_STATE, config);
    console.log(`[e2e auth] BD state saved → ${BD_STATE}`);
  } catch (err) {
    console.warn(`[e2e auth] BD setup failed: ${err}`);
  }

  console.log("[e2e auth] Setting up Supplier auth state...");
  try {
    await saveAuthState(SUPPLIER_EMAIL, SUPPLIER_STATE, config);
    console.log(`[e2e auth] Supplier state saved → ${SUPPLIER_STATE}`);
  } catch (err) {
    console.warn(`[e2e auth] Supplier setup failed: ${err}`);
  }
}

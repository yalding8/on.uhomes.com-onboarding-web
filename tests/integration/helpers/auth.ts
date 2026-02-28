/**
 * Auth helpers for integration tests.
 * Creates authenticated fetch wrappers via Supabase admin generateLink.
 */

import { createHmac } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient, getSupabaseUrl, getAnonKey } from "./admin-client";

/**
 * Create a fetch wrapper that automatically injects Supabase session cookies.
 *
 * Flow:
 * 1. Generate magic link via admin API (no email sent)
 * 2. Exchange the hashed_token for a real session
 * 3. Wrap fetch to include the session cookie
 */
export async function createAuthenticatedFetch(
  email: string,
): Promise<typeof fetch> {
  // Retry to handle race conditions when parallel workers generate
  // magic links for the same email (each new link invalidates the previous)
  const maxAttempts = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const session = await exchangeMagicLink(email);
      return buildFetchWrapper(session);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxAttempts) {
        const delay = 500 + Math.random() * 1000;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError!;
}

async function exchangeMagicLink(
  email: string,
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in: number;
  token_type: string;
}> {
  const admin = createAdminClient();

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

  if (linkError || !linkData) {
    throw new Error(
      `generateLink failed for ${email}: ${linkError?.message ?? "no data"}`,
    );
  }

  const tokenHash = linkData.properties?.hashed_token;
  if (!tokenHash) {
    throw new Error(`No hashed_token in generateLink response for ${email}`);
  }

  const anonClient = createClient(getSupabaseUrl(), getAnonKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: sessionData, error: verifyError } =
    await anonClient.auth.verifyOtp({
      token_hash: tokenHash,
      type: "magiclink",
    });

  if (verifyError || !sessionData.session) {
    throw new Error(
      `verifyOtp failed for ${email}: ${verifyError?.message ?? "no session"}`,
    );
  }

  return sessionData.session;
}

function buildFetchWrapper(session: {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in: number;
  token_type: string;
}): typeof fetch {
  const projectRef = extractProjectRef(getSupabaseUrl());
  const cookieName = `sb-${projectRef}-auth-token`;
  const cookieValue = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
  });

  const cookieChunks = chunkCookie(cookieName, cookieValue);

  return (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const existing = headers.get("cookie") ?? "";
    const testCookies = cookieChunks
      .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
      .join("; ");
    headers.set(
      "cookie",
      existing ? `${existing}; ${testCookies}` : testCookies,
    );
    return fetch(input, { ...init, headers, redirect: "manual" });
  };
}

/**
 * Sign a webhook payload with HMAC-SHA256 (mirrors verifyDocuSignHmac).
 */
export function signWebhookPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64");
}

// ── Internal helpers ──

function extractProjectRef(url: string): string {
  // https://abc123.supabase.co → abc123
  const match = url.match(/\/\/([^.]+)\./);
  return match?.[1] ?? "localhost";
}

interface CookieChunk {
  name: string;
  value: string;
}

function chunkCookie(name: string, value: string): CookieChunk[] {
  const MAX_CHUNK = 3500;
  if (value.length <= MAX_CHUNK) {
    return [{ name: `${name}.0`, value }];
  }
  const chunks: CookieChunk[] = [];
  for (let i = 0; i < value.length; i += MAX_CHUNK) {
    chunks.push({
      name: `${name}.${chunks.length}`,
      value: value.slice(i, i + MAX_CHUNK),
    });
  }
  return chunks;
}

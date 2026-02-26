/**
 * Next.js requires NEXT_PUBLIC_* env vars to be referenced as literal
 * string keys (e.g. process.env.NEXT_PUBLIC_FOO) so the compiler can
 * inline them at build time. Dynamic access like process.env[key] will
 * NOT be replaced and will be undefined on the client.
 */

/** Public Supabase config (available client-side & server-side) */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  if (typeof window === "undefined") {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
}

/** Server-only Supabase admin key */
export function getServiceRoleKey(): string {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) {
    throw new Error(
      "Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return value;
}

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, getServiceRoleKey } from "@/lib/env";

/**
 * Create a Supabase admin client with service role key.
 * Bypasses RLS — use only in trusted server-side contexts (API routes, webhooks).
 */
export function createAdminClient() {
  return createClient(SUPABASE_URL, getServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

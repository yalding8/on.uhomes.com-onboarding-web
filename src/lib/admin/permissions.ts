/**
 * Admin permission helpers — single source of truth for admin vs BD distinction.
 *
 * Admin is a code-level concept, not a database role. Both admin and regular BD
 * share role='bd' in the suppliers table. Admin status is determined by email.
 *
 * Configure via ADMIN_EMAILS env var (comma-separated). Falls back to defaults.
 */

const DEFAULT_ADMIN_EMAILS: ReadonlyArray<string> = [
  "ning.ding@uhomes.com",
  "abby.zhang@uhomes.com",
  "lei.tian@uhomes.com",
];

function loadAdminEmails(): ReadonlyArray<string> {
  const envValue = process.env.ADMIN_EMAILS;
  if (!envValue || envValue.trim() === "") {
    return DEFAULT_ADMIN_EMAILS;
  }
  return envValue
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

export const ADMIN_EMAILS: ReadonlyArray<string> = loadAdminEmails();

export function isAdmin(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

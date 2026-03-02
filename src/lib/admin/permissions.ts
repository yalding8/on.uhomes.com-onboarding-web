/**
 * Admin permission helpers — single source of truth for admin vs BD distinction.
 *
 * Admin is a code-level concept, not a database role. Both admin and regular BD
 * share role='bd' in the suppliers table. Admin status is determined by email.
 */

export const ADMIN_EMAILS: ReadonlyArray<string> = [
  "ning.ding@uhomes.com",
  "abby.zhang@uhomes.com",
  "lei.tian@uhomes.com",
];

export function isAdmin(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

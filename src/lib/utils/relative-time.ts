/**
 * Relative time formatting utility.
 *
 * Converts ISO date strings to human-readable relative time
 * using Intl.RelativeTimeFormat for i18n support.
 */

const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "seconds" },
  { amount: 60, unit: "minutes" },
  { amount: 24, unit: "hours" },
  { amount: 7, unit: "days" },
  { amount: 4.345, unit: "weeks" },
  { amount: 12, unit: "months" },
  { amount: Number.POSITIVE_INFINITY, unit: "years" },
];

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  let diff = (date.getTime() - Date.now()) / 1000;

  // Less than 60 seconds ago
  if (Math.abs(diff) < 60) return "just now";

  for (const division of DIVISIONS) {
    if (Math.abs(diff) < division.amount) {
      const formatter = new Intl.RelativeTimeFormat(undefined, {
        numeric: "auto",
      });
      return formatter.format(Math.round(diff), division.unit);
    }
    diff /= division.amount;
  }

  return date.toLocaleDateString();
}

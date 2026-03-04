import * as Sentry from "@sentry/nextjs";

type SeverityLevel = "fatal" | "error" | "warning" | "info";

/**
 * Capture an error to Sentry with structured context.
 * Safe to call even when Sentry is not configured (dev/test).
 */
export function captureError(
  module: string,
  error: unknown,
  extra?: Record<string, unknown>,
  level: SeverityLevel = "error",
): void {
  const err = error instanceof Error ? error : new Error(String(error));

  Sentry.withScope((scope) => {
    scope.setTag("module", module);
    scope.setLevel(level);
    if (extra) {
      scope.setExtras(extra);
    }
    Sentry.captureException(err);
  });

  console.error(`[${module}]`, err);
}

/**
 * Capture a message-level event for non-exception monitoring.
 */
export function captureMessage(
  module: string,
  message: string,
  level: SeverityLevel = "warning",
  extra?: Record<string, unknown>,
): void {
  Sentry.withScope((scope) => {
    scope.setTag("module", module);
    scope.setLevel(level);
    if (extra) {
      scope.setExtras(extra);
    }
    Sentry.captureMessage(`[${module}] ${message}`);
  });
}

/**
 * Set user context for Sentry (call after auth resolution).
 */
export function setSentryUser(userId: string, role?: string): void {
  Sentry.setUser({ id: userId, role });
}

/**
 * Clear user context on logout.
 */
export function clearSentryUser(): void {
  Sentry.setUser(null);
}

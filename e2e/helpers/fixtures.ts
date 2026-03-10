/**
 * Shared fixtures and helpers for E2E tests.
 */

/** Standard form data for landing page application */
export const VALID_APPLICATION = {
  company: "Test Property LLC",
  email: "test@example.com",
  phone: "+1 555 1234",
  city: "London",
  country: "United Kingdom",
  website: "https://example.com",
} as const;

/** Mock successful API response */
export function mockApiSuccess(body: Record<string, unknown> = {}) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ success: true, ...body }),
  };
}

/** Mock API error response */
export function mockApiError(
  status: number,
  error: string = "Operation failed",
) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify({ error }),
  };
}

/** Mock Supabase OTP endpoint to succeed */
export function mockOtpSuccess() {
  return {
    status: 200,
    contentType: "application/json",
    body: "{}",
  };
}

/** Viewport sizes for responsive tests */
export const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
} as const;

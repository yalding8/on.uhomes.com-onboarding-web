import * as Sentry from "@sentry/nextjs";
import { readConsent } from "@/lib/compliance/cookie-consent";

const consent = readConsent();
const hasAnalyticsConsent = consent?.analytics === true;

Sentry.init({
  dsn: "https://64de63bd7b0315c4c9c4fbab7e77a979@o4511003322351616.ingest.us.sentry.io/4511003327594496",

  integrations: hasAnalyticsConsent ? [Sentry.replayIntegration()] : [],

  tracesSampleRate: 0.2,
  replaysSessionSampleRate: hasAnalyticsConsent ? 0 : 0,
  replaysOnErrorSampleRate: hasAnalyticsConsent ? 1.0 : 0,

  environment:
    process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? "development",

  // Filter out known non-issues
  ignoreErrors: [
    "ResizeObserver loop",
    "Network request failed",
    "Load failed",
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

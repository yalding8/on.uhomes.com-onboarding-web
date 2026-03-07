import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://64de63bd7b0315c4c9c4fbab7e77a979@o4511003322351616.ingest.us.sentry.io/4511003327594496",

  tracesSampleRate: 0.5,

  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
});

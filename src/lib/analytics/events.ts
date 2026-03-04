/**
 * S4.1: PostHog Event Tracking System
 *
 * Defines all measurable funnel events for the onboarding platform.
 * Five funnels: Landing → BD Assignment → Contract Signing → Onboarding → SLA
 */

import posthog from "posthog-js";

// ── Event Name Constants ──

export const EVENTS = {
  // Landing Page Funnel
  LANDING_PAGE_VIEW: "landing_page_view",
  LANDING_CTA_CLICK: "landing_cta_click",
  APPLICATION_FORM_START: "application_form_start",
  APPLICATION_FORM_FIELD_FILL: "application_form_field_fill",
  APPLICATION_FORM_SUBMIT: "application_form_submit",
  APPLICATION_FORM_ERROR: "application_form_error",

  // BD Assignment Funnel
  APPLICATION_BD_ASSIGNED: "application_bd_assigned",
  APPLICATION_BD_FIRST_CONTACT: "application_bd_first_contact",
  APPLICATION_APPROVED: "application_approved",
  APPLICATION_REJECTED: "application_rejected",

  // Contract Signing Funnel
  CONTRACT_EMAIL_SENT: "contract_email_sent",
  CONTRACT_EMAIL_OPENED: "contract_email_opened",
  SUPPLIER_LOGIN: "supplier_login",
  CONTRACT_VIEWED: "contract_viewed",
  CONTRACT_SIGNING_STARTED: "contract_signing_started",
  CONTRACT_SIGNED: "contract_signed",

  // Onboarding Funnel
  BUILDING_CREATED: "building_created",
  EXTRACTION_TRIGGERED: "extraction_triggered",
  EXTRACTION_COMPLETED: "extraction_completed",
  BUILDING_FIELD_EDITED: "building_field_edited",
  BUILDING_SCORE_CHANGED: "building_score_changed",
  BUILDING_PREVIEW_CLICKED: "building_preview_clicked",
  BUILDING_PUBLISHED: "building_published",

  // SLA Metrics
  SLA_5MIN_MET: "sla_5min_met",
  SLA_5MIN_BREACHED: "sla_5min_breached",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

// ── Event Properties ──

export type EventProperties = Record<string, string | number | boolean | null>;

// ── Core Functions ──

export function trackEvent(
  event: EventName,
  properties?: EventProperties,
): void {
  posthog.capture(event, properties);
}

export function initAnalytics(apiKey: string, apiHost: string): void {
  posthog.init(apiKey, {
    api_host: apiHost,
    capture_pageview: true,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
  });
}

export function identifyUser(
  userId: string,
  traits?: Record<string, string | number | boolean>,
): void {
  posthog.identify(userId, traits);
}

export function resetAnalytics(): void {
  posthog.reset();
}

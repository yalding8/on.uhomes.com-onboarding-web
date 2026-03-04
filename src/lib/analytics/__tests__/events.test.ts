import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  trackEvent,
  EVENTS,
  type EventProperties,
  initAnalytics,
  identifyUser,
  resetAnalytics,
} from "../events";

// Mock posthog-js
vi.mock("posthog-js", () => ({
  default: {
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
  },
}));

import posthog from "posthog-js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EVENTS constants", () => {
  it("has all landing page funnel events", () => {
    expect(EVENTS.LANDING_PAGE_VIEW).toBe("landing_page_view");
    expect(EVENTS.LANDING_CTA_CLICK).toBe("landing_cta_click");
    expect(EVENTS.APPLICATION_FORM_START).toBe("application_form_start");
    expect(EVENTS.APPLICATION_FORM_SUBMIT).toBe("application_form_submit");
    expect(EVENTS.APPLICATION_FORM_ERROR).toBe("application_form_error");
  });

  it("has all BD assignment funnel events", () => {
    expect(EVENTS.APPLICATION_BD_ASSIGNED).toBe("application_bd_assigned");
    expect(EVENTS.APPLICATION_BD_FIRST_CONTACT).toBe(
      "application_bd_first_contact",
    );
    expect(EVENTS.APPLICATION_APPROVED).toBe("application_approved");
    expect(EVENTS.APPLICATION_REJECTED).toBe("application_rejected");
  });

  it("has all contract signing funnel events", () => {
    expect(EVENTS.CONTRACT_EMAIL_SENT).toBe("contract_email_sent");
    expect(EVENTS.CONTRACT_EMAIL_OPENED).toBe("contract_email_opened");
    expect(EVENTS.SUPPLIER_LOGIN).toBe("supplier_login");
    expect(EVENTS.CONTRACT_VIEWED).toBe("contract_viewed");
    expect(EVENTS.CONTRACT_SIGNING_STARTED).toBe("contract_signing_started");
    expect(EVENTS.CONTRACT_SIGNED).toBe("contract_signed");
  });

  it("has all onboarding funnel events", () => {
    expect(EVENTS.BUILDING_CREATED).toBe("building_created");
    expect(EVENTS.EXTRACTION_TRIGGERED).toBe("extraction_triggered");
    expect(EVENTS.EXTRACTION_COMPLETED).toBe("extraction_completed");
    expect(EVENTS.BUILDING_FIELD_EDITED).toBe("building_field_edited");
    expect(EVENTS.BUILDING_SCORE_CHANGED).toBe("building_score_changed");
    expect(EVENTS.BUILDING_PREVIEW_CLICKED).toBe("building_preview_clicked");
    expect(EVENTS.BUILDING_PUBLISHED).toBe("building_published");
  });

  it("has SLA metric events", () => {
    expect(EVENTS.SLA_5MIN_MET).toBe("sla_5min_met");
    expect(EVENTS.SLA_5MIN_BREACHED).toBe("sla_5min_breached");
  });
});

describe("trackEvent", () => {
  it("calls posthog.capture with event name and properties", () => {
    const props: EventProperties = { supplier_id: "sup_123", country: "US" };
    trackEvent(EVENTS.LANDING_PAGE_VIEW, props);
    expect(posthog.capture).toHaveBeenCalledWith("landing_page_view", props);
  });

  it("calls posthog.capture with just event name when no properties", () => {
    trackEvent(EVENTS.SUPPLIER_LOGIN);
    expect(posthog.capture).toHaveBeenCalledWith("supplier_login", undefined);
  });
});

describe("initAnalytics", () => {
  it("calls posthog.init with API key and config", () => {
    initAnalytics("phc_test_key", "https://app.posthog.com");
    expect(posthog.init).toHaveBeenCalledWith(
      "phc_test_key",
      expect.objectContaining({ api_host: "https://app.posthog.com" }),
    );
  });
});

describe("identifyUser", () => {
  it("calls posthog.identify with user ID and traits", () => {
    identifyUser("user_123", { role: "supplier", country: "AU" });
    expect(posthog.identify).toHaveBeenCalledWith("user_123", {
      role: "supplier",
      country: "AU",
    });
  });
});

describe("resetAnalytics", () => {
  it("calls posthog.reset", () => {
    resetAnalytics();
    expect(posthog.reset).toHaveBeenCalled();
  });
});

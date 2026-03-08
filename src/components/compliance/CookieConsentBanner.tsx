"use client";

import { useEffect, useState } from "react";
import { Cookie, Settings, Shield } from "lucide-react";
import {
  shouldShowBanner,
  acceptAll,
  rejectOptional,
  saveConsent,
  getDefaultConsent,
  readConsent,
  type ConsentState,
} from "@/lib/compliance/cookie-consent";
import { resetAnalytics } from "@/lib/analytics/events";

type BannerView = "banner" | "settings" | "hidden";

export function CookieConsentBanner({
  countryCode,
}: { countryCode?: string } = {}) {
  const [view, setView] = useState<BannerView>("hidden");
  const [consent, setConsent] = useState<ConsentState>({
    necessary: true,
    functional: false,
    analytics: false,
  });

  useEffect(() => {
    // Read cookie consent from localStorage on mount.
    // Wrapped in rAF to avoid synchronous setState in effect (react-hooks/set-state-in-effect).
    const id = requestAnimationFrame(() => {
      if (shouldShowBanner()) {
        setView("banner");
        setConsent(getDefaultConsent(countryCode));
      } else {
        const saved = readConsent();
        if (saved) setConsent(saved);
      }
    });
    return () => cancelAnimationFrame(id);
  }, []);

  if (view === "hidden") return null;

  const handleAcceptAll = () => {
    const state = acceptAll();
    setConsent(state);
    setView("hidden");
  };

  const handleRejectOptional = () => {
    const prev = readConsent();
    const state = rejectOptional();
    setConsent(state);
    setView("hidden");
    if (prev?.analytics) resetAnalytics();
  };

  const handleSaveSettings = () => {
    const prev = readConsent();
    saveConsent(consent);
    setView("hidden");
    if (prev?.analytics && !consent.analytics) resetAnalytics();
  };

  if (view === "settings") {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center">
        <div className="w-full max-w-lg rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
          <div className="mb-4 flex items-center gap-2">
            <Settings className="h-5 w-5 text-text-secondary" />
            <h3 className="text-lg font-semibold text-text-primary">
              Cookie Settings
            </h3>
          </div>

          <div className="space-y-4">
            <ConsentToggle
              label="Strictly Necessary"
              description="Required for the website to function. Cannot be disabled."
              checked={true}
              disabled={true}
              icon={<Shield className="h-4 w-4" />}
            />
            <ConsentToggle
              label="Functional"
              description="Remember your preferences like language and timezone."
              checked={consent.functional}
              onChange={(v) => setConsent({ ...consent, functional: v })}
              icon={<Settings className="h-4 w-4" />}
            />
            <ConsentToggle
              label="Analytics"
              description="Help us understand how you use the site to improve it."
              checked={consent.analytics}
              onChange={(v) => setConsent({ ...consent, analytics: v })}
              icon={<Cookie className="h-4 w-4" />}
            />
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSaveSettings}
              className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-transform active:scale-[0.98] hover:bg-primary-hover"
            >
              Save Settings
            </button>
            <button
              onClick={() => setView("banner")}
              className="rounded-lg border border-border px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-secondary"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white p-4 shadow-lg sm:mx-auto sm:mb-4 sm:max-w-xl sm:rounded-2xl sm:border">
      <div className="mb-3 flex items-start gap-3">
        <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm text-text-secondary">
          We use cookies to ensure the best experience. You can manage your
          preferences anytime.{" "}
          <a href="/privacy" className="text-primary underline">
            Privacy Policy
          </a>
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleAcceptAll}
          className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-transform active:scale-[0.98] hover:bg-primary-hover"
        >
          Accept All
        </button>
        <button
          onClick={handleRejectOptional}
          className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-bg-secondary"
        >
          Necessary Only
        </button>
        <button
          onClick={() => setView("settings")}
          className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-bg-secondary"
        >
          Customize
        </button>
      </div>
    </div>
  );
}

function ConsentToggle({
  label,
  description,
  checked,
  disabled,
  onChange,
  icon,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (value: boolean) => void;
  icon: React.ReactNode;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-border p-3">
      <div className="mt-0.5 text-text-secondary">{icon}</div>
      <div className="flex-1">
        <div className="text-sm font-medium text-text-primary">{label}</div>
        <div className="text-xs text-text-muted">{description}</div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-1 h-4 w-4 rounded accent-primary"
      />
    </label>
  );
}

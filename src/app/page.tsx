import Link from "next/link";
import { ApplicationForm } from "@/components/form/ApplicationForm";
import { MapPin, ShieldCheck, Zap } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-[var(--color-bg-primary)]">
      {/* Navigation Bar */}
      <nav className="w-full border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="font-bold text-lg tracking-tight text-[var(--color-primary)]">
            uhomes.com
            <span className="text-[var(--color-text-primary)] ml-2">
              Partners
            </span>
          </div>
          <Link
            href="/login"
            className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Supplier Sign In
          </Link>
        </div>
      </nav>

      <div className="w-full max-w-6xl mx-auto px-6 py-20 lg:py-32 grid lg:grid-cols-2 gap-16 lg:gap-8 items-center">
        {/* Hero Copy */}
        <div className="max-w-2xl">
          <div className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-1.5 text-sm font-medium mb-6">
            <span className="flex h-2 w-2 rounded-full bg-[var(--color-success)] mr-2 tracking-wide text-[var(--color-text-secondary)]"></span>
            Accepting New Partners
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-[var(--color-text-primary)] leading-tight tracking-tight mb-6">
            Unlock Millions of Global Students Ready to Move In.
          </h1>
          <p className="text-lg text-[var(--color-text-secondary)] mb-10 leading-relaxed max-w-xl">
            Join the world&apos;s leading student housing ecosystem. Onboard
            your properties in minutes and connect with qualified international
            renters across 200+ countries.
          </p>

          {/* Value Props */}
          <div className="space-y-6">
            <div className="flex items-start">
              <div className="flex-shrink-0 mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary-light)]">
                <Zap className="h-4 w-4 text-[var(--color-primary)] opacity-90" />
              </div>
              <div className="ml-4">
                <h4 className="text-base font-semibold text-[var(--color-text-primary)]">
                  Automated Onboarding
                </h4>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Sign the contract and our AI automatically extracts your
                  building inventory directly from your website.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary-light)]">
                <MapPin className="h-4 w-4 text-[var(--color-primary)] opacity-90" />
              </div>
              <div className="ml-4">
                <h4 className="text-base font-semibold text-[var(--color-text-primary)]">
                  Unrivaled Distribution
                </h4>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Your rooms are instantly distributed across all uhomes
                  platforms and leading partner networks globally.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary-light)]">
                <ShieldCheck className="h-4 w-4 text-[var(--color-primary)] opacity-90" />
              </div>
              <div className="ml-4">
                <h4 className="text-base font-semibold text-[var(--color-text-primary)]">
                  Secure & Managed
                </h4>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Every lead undergoes screening. Access a centralized dashboard
                  to track real-time bookings.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Application Form */}
        <div id="apply-form" className="relative w-full">
          <ApplicationForm />
        </div>
      </div>
    </main>
  );
}

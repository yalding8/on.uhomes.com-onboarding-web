import Link from "next/link";
import { ApplicationForm } from "@/components/form/ApplicationForm";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { createClient } from "@/lib/supabase/server";
import { Globe, ShieldCheck, Zap } from "lucide-react";

interface HomeProps {
  searchParams: Promise<{ ref?: string }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const referralCode = params.ref ?? null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userEmail = user?.email ?? null;
  return (
    <main className="flex min-h-screen flex-col items-center bg-[var(--color-bg-primary)]">
      {/* Navigation Bar */}
      <nav className="w-full border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="font-bold text-lg tracking-tight text-[var(--color-primary)]">
            uhomes.com
            <span className="text-[var(--color-text-primary)] ms-2">
              Partners
            </span>
          </div>
          {userEmail ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--color-text-secondary)] hidden sm:inline truncate max-w-[200px]">
                {userEmail}
              </span>
              <LogoutButton />
            </div>
          ) : (
            <Link
              href="/login"
              className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </nav>

      <div className="w-full max-w-6xl mx-auto px-6 py-12 lg:py-20 grid lg:grid-cols-2 gap-16 lg:gap-8 items-center">
        {/* Hero Copy */}
        <div className="max-w-2xl">
          <div className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-1.5 text-sm font-medium mb-6">
            <span className="flex h-2 w-2 rounded-full bg-[var(--color-success)] me-2 tracking-wide text-[var(--color-text-secondary)]"></span>
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
              <div className="ms-4">
                <h4 className="text-base font-semibold text-[var(--color-text-primary)]">
                  Streamlined Onboarding
                </h4>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Connect your inventory your way — our platform handles setup
                  and standardization so you can go live faster.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary-light)]">
                <Globe className="h-4 w-4 text-[var(--color-primary)] opacity-90" />
              </div>
              <div className="ms-4">
                <h4 className="text-base font-semibold text-[var(--color-text-primary)]">
                  Global Demand Reach
                </h4>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Connect with verified international students through uhomes
                  and our global partner network.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary-light)]">
                <ShieldCheck className="h-4 w-4 text-[var(--color-primary)] opacity-90" />
              </div>
              <div className="ms-4">
                <h4 className="text-base font-semibold text-[var(--color-text-primary)]">
                  Trusted & Transparent
                </h4>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Manage bookings with confidence through verified leads and a
                  centralized partner dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Application Form */}
        <div id="apply-form" className="relative w-full">
          <ApplicationForm
            prefillEmail={userEmail}
            referralCode={referralCode}
          />
        </div>
      </div>

      {/* Social Proof */}
      <section className="w-full border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <p className="text-3xl font-bold text-[var(--color-text-primary)]">
              200+
            </p>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              Partner Countries
            </p>
          </div>
          <div>
            <p className="text-3xl font-bold text-[var(--color-text-primary)]">
              5,000+
            </p>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              Properties Listed
            </p>
          </div>
          <div>
            <p className="text-3xl font-bold text-[var(--color-text-primary)]">
              800+
            </p>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              Accommodation Partners
            </p>
          </div>
          <div>
            <p className="text-3xl font-bold text-[var(--color-text-primary)]">
              1M+
            </p>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              Student Visitors / Year
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-[var(--color-border)] bg-[var(--color-bg-primary)]">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-start">
            <p className="font-bold text-[var(--color-primary)]">
              uhomes.com
              <span className="text-[var(--color-text-primary)] ms-1">
                Partners
              </span>
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              &copy; {new Date().getFullYear()} uhomes.com. All rights reserved.
            </p>
          </div>
          <div className="flex items-center gap-6 text-sm text-[var(--color-text-secondary)]">
            <a
              href="mailto:contact@uhomes.com"
              className="hover:text-[var(--color-text-primary)] transition-colors"
            >
              Contact Us
            </a>
            <a
              href="/privacy"
              className="hover:text-[var(--color-text-primary)] transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href="/terms"
              className="hover:text-[var(--color-text-primary)] transition-colors"
            >
              Terms of Service
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

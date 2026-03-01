import { Globe, BarChart3, Users, Building2 } from "lucide-react";

/**
 * uhomes 平台介绍卡片。
 * 展示 uhomes.com 和 pro.uhomes.com 的核心功能，
 * 供 PENDING_CONTRACT 用户在等待合同期间了解平台生态。
 */
export function PlatformOverview() {
  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
        Get to Know uhomes
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {/* uhomes.com */}
        <a
          href="https://uhomes.com"
          target="_blank"
          rel="noopener noreferrer"
          className="group block rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 hover:border-[var(--color-primary)]/40 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-primary-light)]">
              <Globe className="h-5 w-5 text-[var(--color-primary)]" />
            </div>
            <h3 className="font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] transition-colors">
              uhomes.com
            </h3>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            The leading student accommodation platform connecting international
            students with quality housing worldwide.
          </p>
          <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <li className="flex items-start gap-2">
              <Users className="h-4 w-4 mt-0.5 text-[var(--color-text-muted)] shrink-0" />
              <span>Millions of students across 400+ cities globally</span>
            </li>
            <li className="flex items-start gap-2">
              <Building2 className="h-4 w-4 mt-0.5 text-[var(--color-text-muted)] shrink-0" />
              <span>
                Verified listings with detailed photos, floor plans, and reviews
              </span>
            </li>
          </ul>
        </a>

        {/* pro.uhomes.com */}
        <a
          href="https://pro.uhomes.com"
          target="_blank"
          rel="noopener noreferrer"
          className="group block rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 hover:border-[var(--color-primary)]/40 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-primary-light)]">
              <BarChart3 className="h-5 w-5 text-[var(--color-primary)]" />
            </div>
            <h3 className="font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] transition-colors">
              pro.uhomes.com
            </h3>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            Your supplier management hub — manage properties, track bookings,
            and optimize your listings after onboarding.
          </p>
          <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <li className="flex items-start gap-2">
              <BarChart3 className="h-4 w-4 mt-0.5 text-[var(--color-text-muted)] shrink-0" />
              <span>Real-time booking analytics and performance insights</span>
            </li>
            <li className="flex items-start gap-2">
              <Building2 className="h-4 w-4 mt-0.5 text-[var(--color-text-muted)] shrink-0" />
              <span>Centralized property and room-type management</span>
            </li>
          </ul>
        </a>
      </div>
    </div>
  );
}

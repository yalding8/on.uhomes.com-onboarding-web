"use client";

/**
 * KPI Statistics cards for the Applications dashboard.
 * Displays: Pending count, Unassigned count, Weekly conversion rate.
 */

import { useEffect, useState } from "react";
import { ClipboardList, AlertTriangle, TrendingUp } from "lucide-react";

interface StatsData {
  pending_total: number;
  unassigned_count: number;
  converted_this_week: number;
  total_this_week: number;
  pending_last_week: number;
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-[var(--color-border)] p-4 animate-pulse"
        >
          <div className="h-4 w-20 bg-[var(--color-bg-secondary)] rounded mb-3" />
          <div className="h-8 w-12 bg-[var(--color-bg-secondary)] rounded mb-2" />
          <div className="h-3 w-16 bg-[var(--color-bg-secondary)] rounded" />
        </div>
      ))}
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle: string;
  accentClass?: string;
}

function StatCard({
  icon,
  label,
  value,
  subtitle,
  accentClass,
}: StatCardProps) {
  return (
    <div
      className={`rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-bg-primary)] hover:shadow-md transition-shadow ${accentClass ?? ""}`}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold text-[var(--color-text-primary)]">
        {value}
      </p>
      <p className="text-xs text-[var(--color-text-muted)] mt-1">{subtitle}</p>
    </div>
  );
}

export function ApplicationStats({ isAdmin }: { isAdmin: boolean }) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/admin/applications/stats")
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json() as Promise<StatsData>;
      })
      .then(setStats)
      .catch(() => setError(true));
  }, []);

  if (!stats && !error) return <StatsSkeleton />;

  const pending = stats?.pending_total ?? 0;
  const unassigned = stats?.unassigned_count ?? 0;
  const converted = stats?.converted_this_week ?? 0;
  const totalWeek = stats?.total_this_week ?? 0;
  const lastWeek = stats?.pending_last_week ?? 0;

  const pendingDiff = pending - lastWeek;
  const diffLabel =
    pendingDiff > 0
      ? `+${pendingDiff} vs last week`
      : pendingDiff < 0
        ? `${pendingDiff} vs last week`
        : "Same as last week";

  const conversionLabel =
    totalWeek > 0
      ? `${converted} / ${totalWeek} this week`
      : "No applications this week";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <StatCard
        icon={<ClipboardList className="h-4 w-4 text-[var(--color-primary)]" />}
        label="Pending"
        value={error ? "—" : String(pending)}
        subtitle={
          error ? "Unable to load" : isAdmin ? diffLabel : "Assigned to you"
        }
      />
      {isAdmin ? (
        <StatCard
          icon={
            <AlertTriangle className="h-4 w-4 text-[var(--color-warning)]" />
          }
          label="Unassigned"
          value={error ? "—" : String(unassigned)}
          subtitle={
            error
              ? "Unable to load"
              : unassigned > 0
                ? "Needs assignment"
                : "All assigned"
          }
          accentClass={
            unassigned > 0 ? "border-[var(--color-warning)]/50" : undefined
          }
        />
      ) : (
        <StatCard
          icon={
            <AlertTriangle className="h-4 w-4 text-[var(--color-warning)]" />
          }
          label="Unclaimed"
          value={error ? "—" : String(unassigned)}
          subtitle={error ? "Unable to load" : "Available to claim"}
        />
      )}
      <StatCard
        icon={<TrendingUp className="h-4 w-4 text-[var(--color-success)]" />}
        label="Conversion"
        value={
          error
            ? "—"
            : totalWeek > 0
              ? `${Math.round((converted / totalWeek) * 100)}%`
              : "0%"
        }
        subtitle={error ? "Unable to load" : conversionLabel}
      />
    </div>
  );
}

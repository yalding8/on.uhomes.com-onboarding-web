"use client";

/**
 * KPI Statistics cards for the Suppliers pipeline dashboard.
 * Displays: New, In Progress, Awaiting Signature, Signed, Live counts.
 */

import { useEffect, useState } from "react";
import { FileText, Edit, Clock, CheckCircle2, Globe } from "lucide-react";

interface SupplierStatsData {
  new_contract: number;
  contract_in_progress: number;
  awaiting_signature: number;
  signed: number;
  live: number;
  overdue_count: number;
  avg_onboarding_score: number;
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
      {[0, 1, 2, 3, 4].map((i) => (
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

export function SupplierStats() {
  const [stats, setStats] = useState<SupplierStatsData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/admin/suppliers/stats")
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json() as Promise<SupplierStatsData>;
      })
      .then(setStats)
      .catch(() => setError(true));
  }, []);

  if (!stats && !error) return <StatsSkeleton />;

  const newCount = stats?.new_contract ?? 0;
  const inProgress = stats?.contract_in_progress ?? 0;
  const awaiting = stats?.awaiting_signature ?? 0;
  const signed = stats?.signed ?? 0;
  const live = stats?.live ?? 0;
  const overdue = stats?.overdue_count ?? 0;
  const avgScore = stats?.avg_onboarding_score ?? 0;

  const awaitingSubtitle =
    overdue > 0 ? `${overdue} overdue (>7d)` : "On track";

  const signedSubtitle = `Avg score: ${Math.round(avgScore)}%`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
      <StatCard
        icon={<FileText className="h-4 w-4 text-[var(--color-primary)]" />}
        label="New"
        value={error ? "\u2014" : String(newCount)}
        subtitle={error ? "Unable to load" : "Need contract creation"}
      />
      <StatCard
        icon={<Edit className="h-4 w-4 text-[var(--color-primary)]" />}
        label="In Progress"
        value={error ? "\u2014" : String(inProgress)}
        subtitle={error ? "Unable to load" : "Contract being processed"}
      />
      <StatCard
        icon={<Clock className="h-4 w-4 text-[var(--color-warning)]" />}
        label="Awaiting Signature"
        value={error ? "\u2014" : String(awaiting)}
        subtitle={error ? "Unable to load" : awaitingSubtitle}
        accentClass={
          overdue > 0 ? "border-[var(--color-warning)]/50" : undefined
        }
      />
      <StatCard
        icon={<CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" />}
        label="Signed"
        value={error ? "\u2014" : String(signed)}
        subtitle={error ? "Unable to load" : signedSubtitle}
      />
      <StatCard
        icon={<Globe className="h-4 w-4 text-[var(--color-success)]" />}
        label="Live"
        value={error ? "\u2014" : String(live)}
        subtitle={error ? "Unable to load" : "Published & active"}
      />
    </div>
  );
}

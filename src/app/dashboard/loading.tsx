export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header skeleton */}
        <div className="bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border)] p-6 md:p-8">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-7 w-60 rounded-lg bg-[var(--color-border)] animate-pulse" />
              <div className="h-4 w-36 rounded-lg bg-[var(--color-border)] animate-pulse" />
            </div>
            <div className="h-9 w-24 rounded-lg bg-[var(--color-border)] animate-pulse" />
          </div>
        </div>

        {/* Section title skeleton */}
        <div className="h-5 w-40 rounded-lg bg-[var(--color-border)] animate-pulse" />

        {/* Card grid skeleton */}
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="space-y-2 flex-1">
                  <div className="h-5 w-3/4 rounded bg-[var(--color-border)] animate-pulse" />
                  <div className="h-4 w-1/2 rounded bg-[var(--color-border)] animate-pulse" />
                </div>
                <div className="h-6 w-20 rounded-full bg-[var(--color-border)] animate-pulse" />
              </div>
              <div className="h-2 w-full rounded-full bg-[var(--color-border)] animate-pulse" />
              <div className="h-3 w-32 rounded bg-[var(--color-border)] animate-pulse mt-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

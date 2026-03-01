export default function OnboardingLoading() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top status bar skeleton */}
        <div className="bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border)] p-5 md:p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="h-6 w-48 rounded-lg bg-[var(--color-border)] animate-pulse" />
            <div className="h-6 w-24 rounded-full bg-[var(--color-border)] animate-pulse" />
          </div>
          <div className="h-2 w-full rounded-full bg-[var(--color-border)] animate-pulse" />
          <div className="h-3 w-40 rounded bg-[var(--color-border)] animate-pulse mt-2" />
        </div>

        {/* Two-column layout skeleton */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: field groups */}
          <div className="flex-1 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4"
              >
                <div className="h-5 w-36 rounded bg-[var(--color-border)] animate-pulse mb-4" />
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="space-y-1.5">
                      <div className="h-3 w-24 rounded bg-[var(--color-border)] animate-pulse" />
                      <div className="h-9 w-full rounded-lg bg-[var(--color-border)] animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Right: gap report skeleton */}
          <div className="lg:w-72 xl:w-80 shrink-0">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
              <div className="h-5 w-32 rounded bg-[var(--color-border)] animate-pulse mb-2" />
              <div className="h-3 w-20 rounded bg-[var(--color-border)] animate-pulse mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-4 w-full rounded bg-[var(--color-border)] animate-pulse"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

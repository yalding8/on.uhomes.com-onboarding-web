export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3 pb-2 border-b border-[var(--color-border)]">
        {title}
      </h2>
      <div className="space-y-3 leading-relaxed text-[var(--color-text-secondary)]">
        {children}
      </div>
    </section>
  );
}

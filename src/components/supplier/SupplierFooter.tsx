export function SupplierFooter() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-bg-primary)]">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-6">
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
  );
}

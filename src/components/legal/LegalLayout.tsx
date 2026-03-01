import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface LegalLayoutProps {
  children: React.ReactNode;
  currentPage: "terms" | "privacy";
}

export function LegalLayout({ children, currentPage }: LegalLayoutProps) {
  return (
    <main className="min-h-screen bg-[var(--color-bg-secondary)] flex flex-col">
      {/* Navigation */}
      <nav className="w-full border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="font-bold text-lg tracking-tight text-[var(--color-primary)]"
          >
            uhomes.com
            <span className="text-[var(--color-text-primary)] ms-2">
              Partners
            </span>
          </Link>
          <Link
            href="/"
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </nav>

      {/* Content */}
      <article className="max-w-3xl w-full mx-auto px-6 py-16">
        <div className="bg-[var(--color-bg-primary)] rounded-2xl border border-[var(--color-border)] shadow-sm px-8 py-12 md:px-12">
          {children}
        </div>
      </article>

      {/* Footer with cross-links */}
      <footer className="mt-auto border-t border-[var(--color-border)] bg-[var(--color-bg-primary)]">
        <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[var(--color-text-muted)]">
          <p>
            &copy; {new Date().getFullYear()} UHOMES INTERNATIONAL CO., LIMITED
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/terms"
              className={`hover:text-[var(--color-text-primary)] transition-colors ${currentPage === "terms" ? "text-[var(--color-primary)] font-medium" : ""}`}
            >
              Terms of Service
            </Link>
            <span className="text-[var(--color-border)]">|</span>
            <Link
              href="/privacy"
              className={`hover:text-[var(--color-text-primary)] transition-colors ${currentPage === "privacy" ? "text-[var(--color-primary)] font-medium" : ""}`}
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

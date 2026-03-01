import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";

interface ApplicationSuccessProps {
  showSignIn: boolean;
}

export function ApplicationSuccess({ showSignIn }: ApplicationSuccessProps) {
  return (
    <div className="w-full max-w-xl mx-auto bg-[var(--color-bg-primary)] p-8 md:p-12 rounded-2xl shadow-xl text-center border border-[var(--color-border)]">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-success)]/10 mb-6">
        <CheckCircle2 className="h-8 w-8 text-[var(--color-success)]" />
      </div>
      <h3 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">
        Application Received!
      </h3>
      <p className="text-[var(--color-text-secondary)]">
        We&apos;ve received your application and will be in touch shortly. You
        can also reach us at{" "}
        <a
          href="mailto:contact@uhomes.com"
          className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-medium transition-colors"
        >
          contact@uhomes.com
        </a>
      </p>

      {showSignIn && (
        <>
          <hr className="my-8 border-[var(--color-border)]" />
          <p className="text-[var(--color-text-secondary)] mb-6">
            Sign in to track your application status and next steps.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg bg-[var(--color-primary)] px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 active:scale-[0.98] transition-all"
          >
            Sign In
            <ArrowRight className="ms-2 h-5 w-5" />
          </Link>
        </>
      )}
    </div>
  );
}

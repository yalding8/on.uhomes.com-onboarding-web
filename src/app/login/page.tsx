"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Mail, ArrowRight, Loader2, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  // State mgmt
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [status, setStatus] = useState<
    "idle" | "loading" | "error" | "success"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const startResendCooldown = useCallback(() => {
    setResendCooldown(60);
  }, []);

  // Step 1: Request OTP -> supabase.auth.signInWithOtp()
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setErrorMessage("");
    setStatus("loading");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Redirection isn't strictly necessary with manual OTP, but keeping it cleanly disabled
        shouldCreateUser: true, // Allow BD registration workflows for "new" accounts
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setStatus("error");
      return;
    }

    setStep(2);
    setStatus("idle");
    startResendCooldown();
  };

  // Step 2: Verify OTP -> supabase.auth.verifyOtp()
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 8) {
      setErrorMessage("Please enter a valid 8-digit code.");
      return;
    }

    setErrorMessage("");
    setStatus("loading");

    const {
      error,
      data: { session },
    } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });

    if (error || !session) {
      setErrorMessage(
        error?.message || "Verification failed. Please try again.",
      );
      setStatus("error");
      return;
    }

    setStatus("success");
    // Navigate to root — middleware will redirect based on user role/status
    router.replace("/");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-secondary)] px-4 sm:px-6">
      <div className="w-full max-w-md rounded-2xl bg-[var(--color-bg-primary)] p-8 shadow-xl relative overflow-hidden">
        {/* Brand Header */}
        <div className="mb-8 text-center mt-2">
          {/* We use a simple CSS red circle placeholder for brand if the logo isn't available yet */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-primary-light)] mb-4">
            <Mail className="h-8 w-8 text-[var(--color-primary)] opacity-90" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
            Welcome to uhomes.com
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Supplier Onboarding Platform
          </p>
        </div>

        {/* Step 1: Email Input */}
        {step === 1 && (
          <form onSubmit={handleRequestOtp} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1"
              >
                Work Email Address
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  required
                  disabled={status === "loading"}
                  className="block w-full rounded-lg border border-[var(--color-border)] px-4 py-3 placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition-colors disabled:opacity-50"
                  placeholder="contact@example.property.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {errorMessage && (
              <p className="text-[var(--color-warning)] text-sm">
                {errorMessage}
              </p>
            )}

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
              />
              <span className="text-xs text-[var(--color-text-muted)]">
                I agree to the{" "}
                <Link
                  href="/terms"
                  target="_blank"
                  className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] underline"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] underline"
                >
                  Privacy Policy
                </Link>
              </span>
            </label>

            <button
              type="submit"
              disabled={status === "loading" || !agreed}
              className="flex w-full items-center justify-center rounded-lg bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 active:scale-[0.98] transition-all disabled:opacity-70"
            >
              {status === "loading" ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <>
                  Continue with Email
                  <ArrowRight className="ms-2 h-4 w-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Step 2: OTP Verification */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div className="text-center mb-6">
              <ShieldCheck className="h-6 w-6 text-[var(--color-success)] mx-auto mb-2" />
              <p className="text-sm text-[var(--color-text-secondary)]">
                We&apos;ve sent an 8-digit secure code to <br />
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {email}
                </span>
              </p>
            </div>

            <div>
              <label
                htmlFor="otp"
                className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1"
              >
                Verification Code
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                required
                maxLength={8}
                disabled={status === "loading" || status === "success"}
                className="block w-full text-center tracking-[0.5em] text-lg rounded-lg border border-[var(--color-border)] px-4 py-3 placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition-colors disabled:opacity-50"
                placeholder="00000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
            </div>

            {errorMessage && (
              <p className="text-[var(--color-warning)] text-sm text-center">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={
                status === "loading" || status === "success" || otp.length < 8
              }
              className="flex w-full items-center justify-center rounded-lg bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 active:scale-[0.98] transition-all disabled:opacity-70"
            >
              {status === "loading" ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : status === "success" ? (
                "Verified"
              ) : (
                "Secure Login"
              )}
            </button>

            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                Use a different email address
              </button>
              <button
                type="button"
                disabled={resendCooldown > 0 || status === "loading"}
                onClick={async () => {
                  setErrorMessage("");
                  setStatus("loading");
                  const { error } = await supabase.auth.signInWithOtp({
                    email,
                    options: { shouldCreateUser: true },
                  });
                  if (error) {
                    setErrorMessage(error.message);
                    setStatus("error");
                    return;
                  }
                  setStatus("idle");
                  startResendCooldown();
                }}
                className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendCooldown > 0
                  ? `Resend code in ${resendCooldown}s`
                  : "Resend verification code"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

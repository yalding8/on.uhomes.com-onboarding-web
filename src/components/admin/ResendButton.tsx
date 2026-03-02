"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Loader2 } from "lucide-react";

export function ResendButton({ contractId }: { contractId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleResend = async () => {
    if (loading) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/contracts/${contractId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resend" }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setMessage(data.error ?? "Failed to resend");
        return;
      }
      setMessage("Signing email resent");
      setTimeout(() => setMessage(null), 3000);
      router.refresh();
    } catch {
      setMessage("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={loading}
        onClick={handleResend}
        className="inline-flex items-center text-[var(--color-primary)] hover:underline text-sm disabled:opacity-70"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 me-1 animate-spin" />
        ) : (
          <Mail className="w-3.5 h-3.5 me-1" />
        )}
        Resend Email
      </button>
      {message && (
        <span className="text-xs text-[var(--color-text-muted)]">
          {message}
        </span>
      )}
    </span>
  );
}

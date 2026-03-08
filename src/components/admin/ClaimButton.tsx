"use client";

/**
 * Claim button — allows BD to claim an unassigned application.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";

interface ClaimButtonProps {
  applicationId: string;
  onClaimed?: () => void;
}

export function ClaimButton({ applicationId, onClaimed }: ClaimButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClaim = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/applications/${applicationId}/claim`,
        { method: "POST" },
      );
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to claim");
        return;
      }
      onClaimed?.();
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleClaim}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-primary-light)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <UserPlus className="h-3.5 w-3.5" />
        )}
        Claim
      </button>
      {error && (
        <p className="text-xs text-[var(--color-warning)] mt-1">{error}</p>
      )}
    </div>
  );
}

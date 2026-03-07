"use client";

import { useState, useCallback } from "react";
import { Download, Loader2 } from "lucide-react";

interface SignedContractDownloadProps {
  contractId: string;
  className?: string;
  variant?: "button" | "link";
}

export function SignedContractDownload({
  contractId,
  className,
  variant = "button",
}: SignedContractDownloadProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}/download`);
      if (!res.ok) return;
      const data = (await res.json()) as { url: string };
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch {
      // Silently fail — user can retry
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  if (variant === "link") {
    return (
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        className={
          className ??
          "text-[var(--color-primary)] hover:underline disabled:opacity-50"
        }
      >
        {loading ? "Loading..." : "Download Signed Contract"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className={
        className ??
        "inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] font-medium transition-all active:scale-[0.98] disabled:opacity-50"
      }
    >
      {loading ? (
        <Loader2 className="w-4 h-4 me-2 animate-spin" />
      ) : (
        <Download className="w-4 h-4 me-2" />
      )}
      {loading ? "Generating link..." : "Download Signed Contract (PDF)"}
    </button>
  );
}

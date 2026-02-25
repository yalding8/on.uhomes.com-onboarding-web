"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileSignature, AlertCircle } from "lucide-react";
import type { ContractStatus, ContractFields } from "@/lib/contracts/types";
import { StatusBadge, StatusContent } from "./ContractStatusContent";

interface ContractPreviewProps {
  contractId: string;
  status: ContractStatus;
  fields: ContractFields | null;
  documentUrl: string | null;
}

export function ContractPreview({
  contractId,
  status,
  fields,
  documentUrl,
}: ContractPreviewProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (action: "confirm" | "request_changes") => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/contracts/${contractId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Operation failed, please try again");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error, please try again");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-[var(--color-primary-light)] rounded-lg text-[var(--color-primary)]">
            <FileSignature className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Partnership Agreement
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Contract ID: {contractId.split("-")[0].toUpperCase()}
            </p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Body */}
      <div className="p-6 md:p-8 bg-[var(--color-bg-primary)]">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[var(--color-primary-light)] text-[var(--color-primary)] text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        <StatusContent
          status={status}
          fields={fields}
          documentUrl={documentUrl}
          isLoading={isLoading}
          onAction={handleAction}
        />
      </div>
    </div>
  );
}

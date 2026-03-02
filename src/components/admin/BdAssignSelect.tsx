"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface BdOption {
  id: string;
  company_name: string;
  contact_email: string;
}

interface BdAssignSelectProps {
  supplierId: string;
  currentBdId: string | null;
  bdUsers: BdOption[];
}

export function BdAssignSelect({
  supplierId,
  currentBdId,
  bdUsers,
}: BdAssignSelectProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const bdId = e.target.value || null;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/assign-bd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier_id: supplierId, bd_id: bdId }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to assign");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <select
        disabled={loading}
        defaultValue={currentBdId ?? ""}
        onChange={handleChange}
        className="text-sm border border-[var(--color-border)] rounded-lg px-2 py-1.5 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 disabled:opacity-70 transition-colors"
      >
        <option value="">Unassigned</option>
        {bdUsers.map((bd) => (
          <option key={bd.id} value={bd.id}>
            {bd.company_name} ({bd.contact_email})
          </option>
        ))}
      </select>
      {loading && (
        <Loader2 className="w-4 h-4 animate-spin text-[var(--color-text-muted)]" />
      )}
      {error && (
        <span className="text-xs text-[var(--color-warning)]">{error}</span>
      )}
    </div>
  );
}

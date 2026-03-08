"use client";

/**
 * Supplier milestone timeline — 7-node vertical timeline
 * showing the progression of a supplier through onboarding stages.
 *
 * Fetches data from /api/admin/suppliers/[supplierId]/timeline on mount.
 */

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils/relative-time";

interface TimelineNode {
  label: string;
  status: "completed" | "in_progress" | "pending";
  date: string | null;
}

interface SupplierTimelineProps {
  supplierId: string;
}

function SkeletonNodes() {
  return (
    <div className="space-y-6 py-2">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-5 w-5 rounded-full bg-[var(--color-border)] animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div
              className="h-3.5 rounded bg-[var(--color-border)] animate-pulse"
              style={{ width: `${60 + ((i * 17) % 30)}%` }}
            />
            <div className="h-3 w-16 rounded bg-[var(--color-border)] animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  if (diffMs < sevenDaysMs) {
    return formatRelativeTime(iso);
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function NodeIcon({ status }: { status: TimelineNode["status"] }) {
  switch (status) {
    case "completed":
      return (
        <CheckCircle2
          className="h-5 w-5 text-[var(--color-success)] shrink-0"
          aria-hidden="true"
        />
      );
    case "in_progress":
      return (
        <span className="relative flex h-5 w-5 items-center justify-center shrink-0">
          <span className="absolute h-3 w-3 rounded-full bg-[#3b82f6] opacity-30 animate-ping" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#3b82f6]" />
        </span>
      );
    case "pending":
      return (
        <Circle
          className="h-5 w-5 text-[var(--color-text-muted)] shrink-0"
          aria-hidden="true"
        />
      );
  }
}

function statusText(node: TimelineNode): string {
  if (node.status === "completed" && node.date) {
    return formatDate(node.date);
  }
  if (node.status === "in_progress") {
    return "In progress";
  }
  return "Waiting";
}

function statusColor(status: TimelineNode["status"]): string {
  switch (status) {
    case "completed":
      return "var(--color-success)";
    case "in_progress":
      return "#3b82f6";
    case "pending":
      return "var(--color-text-muted)";
  }
}

export function SupplierTimeline({ supplierId }: SupplierTimelineProps) {
  const [nodes, setNodes] = useState<TimelineNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchTimeline() {
      try {
        const res = await fetch(`/api/admin/suppliers/${supplierId}/timeline`);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data: { nodes: TimelineNode[] } = await res.json();

        if (!cancelled) {
          setNodes(data.nodes);
          setLoading(false);
        }
      } catch (err) {
        console.error("[SupplierTimeline]", err);
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }

    fetchTimeline();
    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  if (loading) {
    return (
      <section aria-label="Supplier timeline loading">
        <SkeletonNodes />
      </section>
    );
  }

  if (error) {
    return (
      <section
        aria-label="Timeline error"
        className="flex flex-col items-center gap-2 py-8 text-center"
      >
        <Loader2 className="h-6 w-6 text-[var(--color-text-muted)]" />
        <p className="text-sm text-[var(--color-text-muted)]">
          Unable to load timeline
        </p>
        <button
          onClick={() => {
            setError(false);
            setLoading(true);
            setNodes([]);
            // Re-trigger effect by toggling state
            setTimeout(() => {
              setError(false);
            }, 0);
          }}
          className="text-xs text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors active:scale-[0.97]"
        >
          Try again
        </button>
      </section>
    );
  }

  return (
    <section aria-label="Supplier milestone timeline">
      <ol className="relative ps-0">
        {nodes.map((node, i) => {
          const isLast = i === nodes.length - 1;

          return (
            <li key={node.label} className="relative flex gap-3 pb-6 last:pb-0">
              {/* Vertical connector line */}
              {!isLast && (
                <span
                  className="absolute start-[9px] top-6 bottom-0 w-px"
                  style={{
                    backgroundColor: "var(--color-border)",
                  }}
                  aria-hidden="true"
                />
              )}

              {/* Icon */}
              <NodeIcon status={node.status} />

              {/* Text content */}
              <div className="min-w-0 flex-1 pt-0.5">
                <p
                  className="text-sm font-medium leading-tight"
                  style={{
                    color:
                      node.status === "pending"
                        ? "var(--color-text-muted)"
                        : "var(--color-text-primary)",
                  }}
                >
                  {node.label}
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: statusColor(node.status) }}
                >
                  {statusText(node)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

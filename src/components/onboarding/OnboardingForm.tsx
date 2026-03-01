"use client";

/**
 * OnboardingForm — Building Onboarding 编辑表单容器（Client Component）。
 * 管理字段编辑状态，debounce 自动保存到 PATCH API。
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { FieldGroup } from "./FieldGroup";
import { ScoreBar } from "./ScoreBar";
import { GapReportPanel } from "./GapReportPanel";
import { useToast, ToastContainer } from "@/components/ui/Toast";
import { Send } from "lucide-react";
import {
  ALL_CATEGORIES,
  getFieldsByCategory,
  type FieldCategory,
} from "@/lib/onboarding/field-schema";
import type { FieldValue } from "@/lib/onboarding/field-value";
import type { ScoreResult } from "@/lib/onboarding/scoring-engine";
import type { GapReport } from "@/lib/onboarding/gap-report";
import type { BuildingStatus } from "@/lib/onboarding/status-engine";

interface OnboardingFormProps {
  buildingId: string;
  buildingName: string;
  initialFields: Record<string, FieldValue>;
  initialScore: ScoreResult;
  initialGapReport: GapReport;
  initialVersion: number;
  initialStatus: BuildingStatus;
}

export function OnboardingForm({
  buildingId,
  buildingName,
  initialFields,
  initialScore,
  initialGapReport,
  initialVersion,
  initialStatus,
}: OnboardingFormProps) {
  const [fields, setFields] = useState(initialFields);
  const [score, setScore] = useState(initialScore);
  const [gapReport, setGapReport] = useState(initialGapReport);
  const [version, setVersion] = useState(initialVersion);
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toasts, toast, dismiss } = useToast();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 组件卸载时清理 debounce timer，防止状态更新 leak
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const saveField = useCallback(
    async (key: string, value: unknown) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/buildings/${buildingId}/fields`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: { [key]: value }, version }),
        });

        if (res.status === 409) {
          toast("warning", "Data modified by another user, please refresh");
          return;
        }
        if (!res.ok) {
          toast("error", "Save failed, please retry");
          return;
        }

        const data = await res.json();
        setFields(data.fields);
        setScore(data.score);
        setGapReport(data.gapReport);
        setVersion(data.version);
        setStatus(data.status);
        toast("success", "Saved");
      } catch {
        toast("error", "Network error, please check your connection");
      } finally {
        setSaving(false);
      }
    },
    [buildingId, version, toast],
  );

  const handleChange = useCallback(
    (key: string, value: unknown) => {
      // 乐观更新本地状态
      setFields((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          value,
          source: "manual_input" as const,
          confidence: "high" as const,
          updatedAt: new Date().toISOString(),
          updatedBy: "current_user",
        },
      }));

      // Debounce 保存
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => saveField(key, value), 600);
    },
    [saveField],
  );

  const handleSubmit = async () => {
    if (submitting || saving) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/buildings/${buildingId}/submit`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        status?: string;
        error?: string;
        missingFields?: { key: string; label: string }[];
      };

      if (!res.ok) {
        if (data.missingFields && data.missingFields.length > 0) {
          const labels = data.missingFields.map((f) => f.label).join(", ");
          toast("error", `Required fields not filled: ${labels}`, 6000);
        } else {
          toast("error", data.error ?? "Submission failed, please retry");
        }
        return;
      }

      setStatus(data.status as BuildingStatus);
      toast("success", "Submitted for review");
    } catch {
      toast("error", "Network error, please check your connection");
    } finally {
      setSubmitting(false);
    }
  };

  const grouped = getFieldsByCategory();

  return (
    <div className="space-y-6">
      {/* 顶部状态栏 */}
      <div className="bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border)] p-5 md:p-6">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] truncate">
            {buildingName}
          </h1>
          <div className="flex items-center gap-3">
            {saving && (
              <span className="text-xs text-[var(--color-text-muted)]">
                Saving...
              </span>
            )}
            <StatusLabel status={status} />
            {status === "previewable" && (
              <button
                onClick={handleSubmit}
                disabled={submitting || saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                {submitting ? "Submitting..." : "Submit for Review"}
              </button>
            )}
            {(status === "ready_to_publish" || status === "published") && (
              <span className="text-xs text-[var(--color-text-muted)]">
                {status === "ready_to_publish"
                  ? "Submitted, pending team review"
                  : "Published"}
              </span>
            )}
          </div>
        </div>
        <ScoreBar score={score.score} />
        <p className="text-xs text-[var(--color-text-muted)] mt-2">
          {score.totalWeight - score.filledWeight === 0
            ? "All fields completed"
            : `${gapReport.filledFields}/${gapReport.totalFields} fields completed`}
          {score.missingFields.length > 0 &&
            `, ${score.missingFields.length} remaining`}
        </p>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      {/* 主体：两栏布局 */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* 左侧：字段编辑 */}
        <div className="flex-1 space-y-4">
          {ALL_CATEGORIES.map((cat: FieldCategory) => {
            const catFields = grouped[cat];
            if (!catFields || catFields.length === 0) return null;
            return (
              <FieldGroup
                key={cat}
                category={cat}
                fields={catFields}
                fieldValues={fields}
                onChange={handleChange}
                defaultOpen={cat === "basic_info"}
              />
            );
          })}
        </div>

        {/* 右侧：Gap Report（桌面端侧边栏） */}
        <div className="lg:w-72 xl:w-80 shrink-0">
          <div className="lg:sticky lg:top-6">
            <GapReportPanel gapReport={gapReport} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusLabel({ status }: { status: BuildingStatus }) {
  const map: Record<BuildingStatus, { label: string; color: string }> = {
    extracting: { label: "Extracting", color: "var(--color-text-muted)" },
    incomplete: { label: "Draft", color: "var(--color-warning)" },
    previewable: {
      label: "Ready to Preview",
      color: "var(--color-success)",
    },
    ready_to_publish: {
      label: "Ready to Publish",
      color: "var(--color-primary)",
    },
    published: { label: "Published", color: "var(--color-success)" },
  };
  const cfg = map[status] ?? map.incomplete;
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full border"
      style={{ color: cfg.color, borderColor: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

"use client";

/**
 * OnboardingForm — Building Onboarding 编辑表单容器（Client Component）。
 * 管理字段编辑状态，debounce 自动保存到 PATCH API。
 */

import { useState, useCallback, useRef } from "react";
import { FieldGroup } from "./FieldGroup";
import { ScoreBar } from "./ScoreBar";
import { GapReportPanel } from "./GapReportPanel";
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
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveField = useCallback(
    async (key: string, value: unknown) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/buildings/${buildingId}/fields`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: { [key]: value }, version }),
        });

        if (res.status === 409) {
          setError("数据已被其他用户修改，请刷新页面");
          return;
        }
        if (!res.ok) {
          setError("保存失败，请重试");
          return;
        }

        const data = await res.json();
        setFields(data.fields);
        setScore(data.score);
        setGapReport(data.gapReport);
        setVersion(data.version);
        setStatus(data.status);
      } catch {
        setError("网络错误，请检查连接");
      } finally {
        setSaving(false);
      }
    },
    [buildingId, version],
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

  const grouped = getFieldsByCategory();

  return (
    <div className="space-y-6">
      {/* 顶部状态栏 */}
      <div className="bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border)] p-5 md:p-6">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] truncate">
            {buildingName}
          </h1>
          <div className="flex items-center gap-2">
            {saving && (
              <span className="text-xs text-[var(--color-text-muted)]">
                保存中...
              </span>
            )}
            <StatusLabel status={status} />
          </div>
        </div>
        <ScoreBar score={score.score} />
        <p className="text-xs text-[var(--color-text-muted)] mt-2">
          已完成{" "}
          {score.totalWeight - score.filledWeight === 0
            ? "全部"
            : `${gapReport.filledFields}/${gapReport.totalFields}`}{" "}
          字段
          {score.missingFields.length > 0 &&
            `，还有 ${score.missingFields.length} 个待填写`}
        </p>
        {error && (
          <p className="text-xs mt-2" style={{ color: "var(--color-primary)" }}>
            {error}
          </p>
        )}
      </div>

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
    extracting: { label: "提取中", color: "var(--color-text-muted)" },
    incomplete: { label: "待完善", color: "var(--color-warning)" },
    previewable: { label: "可预览", color: "var(--color-success)" },
    ready_to_publish: { label: "待发布", color: "var(--color-primary)" },
    published: { label: "已发布", color: "var(--color-success)" },
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

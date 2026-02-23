/**
 * ScoreBar — 质量评分进度条组件。
 * ≥80 绿色（达标），<80 橙色（待完善）。
 */

interface ScoreBarProps {
  score: number;
  size?: "sm" | "md";
}

export function ScoreBar({ score, size = "md" }: ScoreBarProps) {
  const isReady = score >= 80;
  const barColor = isReady ? "var(--color-success)" : "var(--color-warning)";
  const height = size === "sm" ? "h-2" : "h-3";

  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex-1 ${height} rounded-full overflow-hidden`}
        style={{ backgroundColor: "var(--color-border)" }}
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Quality score: ${score}%`}
      >
        <div
          className={`${height} rounded-full transition-all duration-300`}
          style={{
            width: `${Math.min(score, 100)}%`,
            backgroundColor: barColor,
          }}
        />
      </div>
      <span
        className="text-sm font-semibold tabular-nums min-w-[3ch] text-right"
        style={{ color: barColor }}
      >
        {score}
      </span>
    </div>
  );
}

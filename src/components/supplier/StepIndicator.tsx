import { Check } from "lucide-react";
import { SUPPLIER_STEPS, type SupplierStep } from "./types";

interface StepIndicatorProps {
  currentStep: SupplierStep;
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const currentIndex = SUPPLIER_STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-3">
      <div className="max-w-6xl mx-auto px-6">
        {/* Desktop: horizontal stepper */}
        <div className="hidden md:flex items-center">
          {SUPPLIER_STEPS.map((step, i) => {
            const isCompleted = i < currentIndex;
            const isCurrent = i === currentIndex;
            return (
              <div
                key={step.key}
                className="flex items-center flex-1 last:flex-none"
              >
                <div className="flex flex-col items-center">
                  {/* Circle */}
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                      isCompleted
                        ? "bg-[var(--color-success)] text-white"
                        : isCurrent
                          ? "bg-[var(--color-primary)] text-white"
                          : "border-2 border-[var(--color-border)] text-[var(--color-text-muted)]"
                    }`}
                  >
                    {isCompleted ? <Check className="h-4 w-4" /> : i + 1}
                  </div>
                  {/* Label */}
                  <span
                    className={`mt-1.5 text-xs whitespace-nowrap ${
                      isCurrent
                        ? "font-bold text-[var(--color-text-primary)]"
                        : isCompleted
                          ? "text-[var(--color-success)]"
                          : "text-[var(--color-text-muted)]"
                    }`}
                  >
                    {step.shortLabel}
                  </span>
                </div>
                {/* Connector line */}
                {i < SUPPLIER_STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-3 mt-[-1.25rem] ${
                      i < currentIndex
                        ? "bg-[var(--color-success)]"
                        : "bg-[var(--color-border)]"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile: compact progress bar */}
        <div className="md:hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
              {SUPPLIER_STEPS[currentIndex]?.label ?? "Unknown"}
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">
              Step {currentIndex + 1} of {SUPPLIER_STEPS.length}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[var(--color-border)]">
            <div
              className="h-full rounded-full bg-[var(--color-primary)] transition-all"
              style={{
                width: `${((currentIndex + 1) / SUPPLIER_STEPS.length) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

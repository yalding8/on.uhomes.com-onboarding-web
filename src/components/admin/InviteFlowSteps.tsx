/**
 * Onboarding flow step indicator for the Invite page.
 * Shows 4 stages: Invite → Register → Contract → Go Live.
 * First step is highlighted; remaining steps are muted.
 */

import { UserPlus, UserCheck, FileSignature, Globe } from "lucide-react";
import type { ComponentType } from "react";

interface Step {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    icon: UserPlus,
    title: "Invite",
    description: "You send the invitation",
  },
  {
    icon: UserCheck,
    title: "Register",
    description: "They create their account",
  },
  {
    icon: FileSignature,
    title: "Contract",
    description: "Sign the partner agreement",
  },
  {
    icon: Globe,
    title: "Go Live",
    description: "Buildings go live",
  },
];

export function InviteFlowSteps() {
  return (
    <div className="mb-8">
      {/* Desktop: horizontal row */}
      <div className="hidden md:flex items-start gap-0">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isActive = i === 0;
          return (
            <div key={step.title} className="flex items-start flex-1 min-w-0">
              <div className="flex flex-col items-center text-center flex-1">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full mb-2 ${
                    isActive
                      ? "bg-[var(--color-primary-light)] text-[var(--color-primary)]"
                      : "bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <p
                  className={`text-xs font-semibold mb-0.5 ${
                    isActive
                      ? "text-[var(--color-primary)]"
                      : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  {step.title}
                </p>
                <p className="text-[11px] text-[var(--color-text-muted)] leading-tight">
                  {step.description}
                </p>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex items-center pt-5 px-1 shrink-0">
                  <div className="w-8 border-t border-dashed border-[var(--color-border)]" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: 2×2 grid */}
      <div className="grid grid-cols-2 gap-3 md:hidden">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isActive = i === 0;
          return (
            <div
              key={step.title}
              className="flex items-start gap-2.5 rounded-lg border border-[var(--color-border)] p-3"
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  isActive
                    ? "bg-[var(--color-primary-light)] text-[var(--color-primary)]"
                    : "bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p
                  className={`text-xs font-semibold ${
                    isActive
                      ? "text-[var(--color-primary)]"
                      : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  {step.title}
                </p>
                <p className="text-[11px] text-[var(--color-text-muted)] leading-tight">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

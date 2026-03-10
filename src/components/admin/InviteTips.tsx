/**
 * Right-side tips panel for the Invite page.
 * Provides contextual guidance for BDs filling the invite form.
 */

import { Lightbulb, FileText, HelpCircle } from "lucide-react";
import type { ComponentType } from "react";

interface TipCard {
  icon: ComponentType<{ className?: string }>;
  title: string;
  items: string[];
}

const TIPS: TipCard[] = [
  {
    icon: Lightbulb,
    title: "Quick Tips",
    items: [
      "Use the supplier's official business email",
      "The invitation link expires in 7 days",
      "Supplier will be assigned to you as their BD",
    ],
  },
  {
    icon: FileText,
    title: "Pre-fill Contract Fields",
    items: [
      "If you already have contract details, expand the section in the form",
      "Pre-filled contracts skip DRAFT and go directly to Pending Review",
    ],
  },
  {
    icon: HelpCircle,
    title: "Need Help?",
    items: [
      "For bulk invitations, contact your admin",
      "Having issues? Reach out on the internal channel",
    ],
  },
];

export function InviteTips() {
  return (
    <div className="flex flex-col gap-4">
      {TIPS.map((tip) => {
        const Icon = tip.icon;
        return (
          <div
            key={tip.title}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <Icon className="h-4 w-4 text-[var(--color-primary)]" />
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                {tip.title}
              </h3>
            </div>
            <ul className="space-y-2">
              {tip.items.map((item) => (
                <li
                  key={item}
                  className="text-xs text-[var(--color-text-secondary)] leading-relaxed ps-4 relative before:content-['•'] before:absolute before:start-0 before:text-[var(--color-text-muted)]"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

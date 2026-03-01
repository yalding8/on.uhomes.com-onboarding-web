import { Clock } from "lucide-react";
import { PlatformOverview } from "@/components/dashboard/PlatformOverview";

/**
 * 已提交申请的已登录用户看到的状态卡片。
 * 替代重复显示的申请表单。
 */
export function ApplicationUnderReview() {
  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      <div className="bg-[var(--color-bg-primary)] p-8 md:p-12 rounded-2xl shadow-xl text-center border border-[var(--color-border)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-warning-light)] mb-6">
          <Clock className="h-8 w-8 text-[var(--color-warning)]" />
        </div>
        <h3 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">
          Application Under Review
        </h3>
        <p className="text-[var(--color-text-secondary)]">
          Our Business Development team is reviewing your application. You will
          receive an email notification once approved. You can also reach us at{" "}
          <a
            href="mailto:contact@uhomes.com"
            className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-medium transition-colors"
          >
            contact@uhomes.com
          </a>
        </p>
      </div>

      <PlatformOverview />
    </div>
  );
}

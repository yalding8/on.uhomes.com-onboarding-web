import {
  Loader2,
  CheckCircle2,
  Clock,
  Mail,
  Download,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import type { ContractStatus, ContractFields } from "@/lib/contracts/types";

/** 9 个动态字段的中文标签映射 */
export const FIELD_LABELS: Record<keyof ContractFields, string> = {
  partner_company_name: "合作公司名称",
  partner_contact_name: "联系人姓名",
  partner_address: "公司地址",
  partner_city: "所在城市",
  partner_country: "所在国家",
  commission_rate: "佣金比例 (%)",
  contract_start_date: "合同开始日期",
  contract_end_date: "合同结束日期",
  covered_properties: "覆盖房源",
};

/** 字段展示顺序 */
export const FIELD_ORDER: ReadonlyArray<keyof ContractFields> = [
  "partner_company_name",
  "partner_contact_name",
  "partner_address",
  "partner_city",
  "partner_country",
  "commission_rate",
  "contract_start_date",
  "contract_end_date",
  "covered_properties",
];

/** 状态徽章 */
export function StatusBadge({ status }: { status: ContractStatus }) {
  switch (status) {
    case "SIGNED":
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[var(--color-success-light)] text-[var(--color-success)]">
          <CheckCircle2 className="w-4 h-4 mr-1.5" />
          已签署
        </span>
      );
    case "CANCELED":
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]">
          已取消
        </span>
      );
    case "PENDING_REVIEW":
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[var(--color-warning-light)] text-[var(--color-warning)]">
          待审阅
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[var(--color-primary-light)] text-[var(--color-primary)]">
          处理中
        </span>
      );
  }
}

/** 根据合同状态渲染不同内容 */
export function StatusContent({
  status,
  fields,
  documentUrl,
  isLoading,
  onAction,
}: {
  status: ContractStatus;
  fields: ContractFields | null;
  documentUrl: string | null;
  isLoading: boolean;
  onAction: (action: "confirm" | "request_changes") => void;
}) {
  switch (status) {
    case "DRAFT":
      return <DraftContent />;
    case "PENDING_REVIEW":
      return (
        <PendingReviewContent
          fields={fields}
          isLoading={isLoading}
          onAction={onAction}
        />
      );
    case "CONFIRMED":
      return <ConfirmedContent />;
    case "SENT":
      return <SentContent />;
    case "SIGNED":
      return <SignedContent documentUrl={documentUrl} />;
    case "CANCELED":
      return <CanceledContent />;
  }
}

/** DRAFT 状态：合同正在准备中 */
function DraftContent() {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] mb-4">
        <Clock className="w-8 h-8" />
      </div>
      <h4 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
        合同正在准备中
      </h4>
      <p className="text-sm text-[var(--color-text-secondary)]">
        BD 团队正在为您准备合作协议，请耐心等待。
      </p>
    </div>
  );
}

/** PENDING_REVIEW 状态：展示字段详情 + 操作按钮 */
function PendingReviewContent({
  fields,
  isLoading,
  onAction,
}: {
  fields: ContractFields | null;
  isLoading: boolean;
  onAction: (action: "confirm" | "request_changes") => void;
}) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--color-text-secondary)]">
        请仔细审阅以下合同条款，确认无误后点击{"\u201C"}确认并进入签署{"\u201D"}
        。
      </p>

      {fields && (
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
          data-testid="contract-fields"
        >
          {FIELD_ORDER.map((key) => (
            <div
              key={key}
              className="p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
            >
              <dt className="text-xs text-[var(--color-text-muted)] mb-1">
                {FIELD_LABELS[key]}
              </dt>
              <dd
                className="text-sm font-medium text-[var(--color-text-primary)]"
                data-testid={`field-${key}`}
              >
                {fields[key] || "—"}
              </dd>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          type="button"
          disabled={isLoading}
          onClick={() => onAction("confirm")}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] font-medium transition-colors disabled:opacity-70"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              处理中...
            </>
          ) : (
            "确认并进入签署"
          )}
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={() => onAction("request_changes")}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] font-medium transition-colors disabled:opacity-70"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          请求修改
        </button>
      </div>

      <p className="text-xs text-[var(--color-text-muted)]">
        点击{"\u201C"}确认并进入签署{"\u201D"}后，系统将通过 DocuSign
        发送签署邮件至您的注册邮箱。
      </p>
    </div>
  );
}

/** CONFIRMED 状态：正在创建签署请求 */
function ConfirmedContent() {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] mb-4">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
      <h4 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
        正在创建签署请求...
      </h4>
      <p className="text-sm text-[var(--color-text-secondary)]">
        系统正在通过 DocuSign 创建签署信封，请稍候。
      </p>
    </div>
  );
}

/** SENT 状态：签署邮件已发送 */
function SentContent() {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-success-light)] text-[var(--color-success)] mb-4">
        <Mail className="w-8 h-8" />
      </div>
      <h4 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
        签署邮件已发送，请查收邮箱
      </h4>
      <p className="text-sm text-[var(--color-text-secondary)]">
        DocuSign 签署链接已发送至您的注册邮箱，请按照邮件指引完成电子签名。
      </p>
    </div>
  );
}

/** SIGNED 状态：签署完成 + 下载链接 */
function SignedContent({ documentUrl }: { documentUrl: string | null }) {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-success-light)] text-[var(--color-success)] mb-4">
        <CheckCircle2 className="w-8 h-8" />
      </div>
      <h4 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
        合同签署完成
      </h4>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        您的合作协议已签署生效，感谢您的信任与合作。
      </p>
      {documentUrl && (
        <a
          href={documentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] font-medium transition-colors"
        >
          <Download className="w-4 h-4 mr-2" />
          下载已签署合同 (PDF)
        </a>
      )}
    </div>
  );
}

/** CANCELED 状态：合同已取消 */
function CanceledContent() {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] mb-4">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h4 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
        合同已取消
      </h4>
      <p className="text-sm text-[var(--color-text-secondary)]">
        该合同已被取消，如有疑问请联系 BD 团队。
      </p>
    </div>
  );
}

/**
 * BD 合同编辑页面 — Server Component
 *
 * 加载合同 + 供应商数据，传递给 ContractEditForm 客户端组件处理编辑交互。
 *
 * Requirements: 3.1, 3.2, 3.5, 4.2, 4.4
 */

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ContractEditForm } from "@/components/admin/ContractEditForm";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdmin as checkAdmin } from "@/lib/admin/permissions";
import type { ContractFields, ContractStatus } from "@/lib/contracts/types";

interface RouteParams {
  params: Promise<{ contractId: string }>;
}

export default async function ContractEditPage({ params }: RouteParams) {
  // Auth: verify BD session
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase
    .from("suppliers")
    .select("id, contact_email")
    .eq("user_id", user.id)
    .eq("role", "bd")
    .single();
  if (!me) redirect("/login");

  const { contractId } = await params;
  const supabaseAdmin = createAdminClient();

  // 1. 查询合同记录
  const { data: contract, error: contractError } = await supabaseAdmin
    .from("contracts")
    .select(
      "id, supplier_id, status, contract_fields, uploaded_document_url, updated_at",
    )
    .eq("id", contractId)
    .single();

  if (contractError || !contract) {
    notFound();
  }

  // BD scoping: non-admin BD can only edit contracts for assigned suppliers
  if (!checkAdmin(me.contact_email)) {
    const { data: target } = await supabaseAdmin
      .from("suppliers")
      .select("bd_user_id")
      .eq("id", contract.supplier_id)
      .single();
    if (target?.bd_user_id !== me.id) notFound();
  }

  // 2. 查询关联供应商信息
  const { data: supplier, error: supplierError } = await supabaseAdmin
    .from("suppliers")
    .select("company_name, contact_email")
    .eq("id", contract.supplier_id)
    .single();

  if (supplierError || !supplier) {
    notFound();
  }

  // 3. 尝试从 applications 表获取城市信息（用于预填）
  const { data: application } = await supabaseAdmin
    .from("applications")
    .select("city")
    .eq("contact_email", supplier.contact_email)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return (
    <div>
      <Link
        href={`/admin/suppliers/${contract.supplier_id}`}
        className="inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4"
      >
        ← Back to Supplier
      </Link>

      <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-6">
        Edit Contract
      </h1>

      <ContractEditForm
        contractId={contractId}
        initialFields={
          (contract.contract_fields ?? {}) as Partial<ContractFields>
        }
        supplierInfo={{
          company_name: supplier.company_name as string,
          city: (application?.city as string | null) ?? null,
        }}
        contractStatus={contract.status as ContractStatus}
        uploadedDocumentUrl={
          (contract.uploaded_document_url as string | null) ?? null
        }
        initialUpdatedAt={contract.updated_at as string}
      />
    </div>
  );
}

/**
 * Suppliers Pipeline — Server Component
 *
 * Admin: all suppliers. BD: only assigned suppliers.
 * Enriches each supplier with contract, building, and pipeline data.
 */

import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { SupplierList } from "@/components/admin/SupplierList";
import type { SupplierTableRow } from "@/components/admin/SupplierTable";
import type { BdOption } from "@/app/admin/applications/page";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdmin as checkAdmin } from "@/lib/admin/permissions";
import { computePipelineStage, getNextAction } from "@/lib/suppliers/pipeline";

async function getPageContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase
    .from("suppliers")
    .select("id, contact_email, role")
    .eq("user_id", user.id)
    .eq("role", "bd")
    .single();
  if (!me) return null;
  return { bdSupplierId: me.id, isAdmin: checkAdmin(me.contact_email) };
}

async function getBdUsers(): Promise<BdOption[]> {
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("suppliers")
    .select("id, company_name, contact_email")
    .eq("role", "bd")
    .order("company_name");
  if (error) {
    console.error("[suppliers page] Failed to fetch BD users", error);
    return [];
  }
  return (data as BdOption[]) ?? [];
}

async function getEnrichedSuppliers(
  isAdmin: boolean,
  bdSupplierId: string,
): Promise<SupplierTableRow[]> {
  const db = createAdminClient();

  // 1. Fetch base supplier data
  let query = db
    .from("suppliers")
    .select(
      "id, ref_code, company_name, contact_email, contact_phone, city, country, website_url, status, created_at, bd_user_id",
    )
    .eq("role", "supplier")
    .order("created_at", { ascending: false });

  if (!isAdmin) {
    query = query.eq("bd_user_id", bdSupplierId);
  }

  const { data: suppliers, error: suppliersErr } = await query;
  if (suppliersErr) {
    console.error("[suppliers page] fetch suppliers", suppliersErr);
    return [];
  }
  if (!suppliers || suppliers.length === 0) return [];

  const ids = suppliers.map((s) => s.id);

  // 2. Fetch latest non-CANCELED contract per supplier
  const { data: contracts, error: contractsErr } = await db
    .from("contracts")
    .select("supplier_id, status, created_at, updated_at, signed_at")
    .in("supplier_id", ids)
    .neq("status", "CANCELED")
    .order("created_at", { ascending: false });
  if (contractsErr) {
    console.error("[suppliers page] fetch contracts", contractsErr);
  }

  // Keep only latest contract per supplier
  const contractMap = new Map<
    string,
    {
      status: string;
      created_at: string;
      updated_at: string;
      signed_at: string | null;
    }
  >();
  for (const c of contracts ?? []) {
    if (!contractMap.has(c.supplier_id)) {
      contractMap.set(c.supplier_id, {
        status: c.status,
        created_at: c.created_at,
        updated_at: c.updated_at,
        signed_at: c.signed_at,
      });
    }
  }

  // 3. Fetch buildings with onboarding status + score
  const { data: buildings, error: buildingsErr } = await db
    .from("buildings")
    .select("supplier_id, onboarding_status, score")
    .in("supplier_id", ids);
  if (buildingsErr) {
    console.error("[suppliers page] fetch buildings", buildingsErr);
  }

  const buildingMap = new Map<
    string,
    { onboarding_status: string; score: number }[]
  >();
  for (const b of buildings ?? []) {
    const arr = buildingMap.get(b.supplier_id) ?? [];
    arr.push({
      onboarding_status: b.onboarding_status ?? "incomplete",
      score: b.score ?? 0,
    });
    buildingMap.set(b.supplier_id, arr);
  }

  // 4. BD display names (admin only)
  const bdNameMap = new Map<string, string>();
  if (isAdmin) {
    const bdIds = [
      ...new Set(suppliers.map((s) => s.bd_user_id).filter(Boolean)),
    ] as string[];
    if (bdIds.length > 0) {
      const { data: bds, error: bdsErr } = await db
        .from("suppliers")
        .select("id, company_name")
        .in("id", bdIds);
      if (bdsErr) {
        console.error("[suppliers page] fetch BD names", bdsErr);
      }
      bds?.forEach((b) => bdNameMap.set(b.id, b.company_name));
    }
  }

  // 5. Build enriched rows
  return suppliers.map((s) => {
    const contract = contractMap.get(s.id) ?? null;
    const blds = buildingMap.get(s.id) ?? [];
    const bldForPipeline = blds.map((b) => ({
      onboarding_status: b.onboarding_status,
    }));
    const bldForAction = blds.map((b) => ({
      onboarding_status: b.onboarding_status,
      score: b.score,
    }));

    const pipelineStage = computePipelineStage(
      s.status,
      contract?.status ?? null,
      bldForPipeline,
    );
    const nextAction = getNextAction(
      pipelineStage,
      contract?.status ?? null,
      bldForAction,
    );

    const scores = blds.map((b) => b.score).filter((v) => v > 0);
    const avgScore =
      scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : null;
    const publishedCount = blds.filter(
      (b) => b.onboarding_status === "published",
    ).length;

    return {
      id: s.id,
      ref_code: s.ref_code ?? null,
      company_name: s.company_name,
      contact_email: s.contact_email,
      contact_phone: s.contact_phone ?? null,
      city: s.city ?? null,
      country: s.country ?? null,
      website_url: s.website_url ?? null,
      status: s.status,
      created_at: s.created_at,
      bd_display_name: s.bd_user_id
        ? (bdNameMap.get(s.bd_user_id) ?? null)
        : null,
      pipeline_stage: pipelineStage,
      contract_status: contract?.status ?? null,
      contract_created_at: contract?.created_at ?? null,
      contract_updated_at: contract?.updated_at ?? null,
      contract_signed_at: contract?.signed_at ?? null,
      building_count: blds.length,
      avg_score: avgScore,
      published_count: publishedCount,
      next_action: nextAction,
    } satisfies SupplierTableRow;
  });
}

export default async function SuppliersPage() {
  const ctx = await getPageContext();
  if (!ctx) redirect("/login");

  const [suppliers, bdUsers] = await Promise.all([
    getEnrichedSuppliers(ctx.isAdmin, ctx.bdSupplierId),
    ctx.isAdmin ? getBdUsers() : Promise.resolve([] as BdOption[]),
  ]);

  const title = ctx.isAdmin ? "Suppliers" : "My Suppliers";

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">
        {title}
      </h1>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        {ctx.isAdmin
          ? `${suppliers.length} suppliers on the platform`
          : `${suppliers.length} suppliers assigned to you`}
      </p>
      {suppliers.length === 0 ? (
        <div className="flex flex-col items-center py-12 px-6 text-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-primary-light)] mb-6">
            <Users className="h-8 w-8 text-[var(--color-primary)] opacity-60" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
            {ctx.isAdmin ? "No Suppliers Yet" : "No Suppliers Assigned"}
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)] max-w-sm mb-4">
            {ctx.isAdmin
              ? "Suppliers will appear here once they apply or are invited."
              : "Contact your admin to get suppliers assigned to you."}
          </p>
          {ctx.isAdmin && (
            <a
              href="/admin/invite"
              className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-medium transition-colors"
            >
              Invite your first supplier
            </a>
          )}
        </div>
      ) : (
        <SupplierList
          suppliers={suppliers}
          bdUsers={bdUsers}
          isAdmin={ctx.isAdmin}
        />
      )}
    </div>
  );
}

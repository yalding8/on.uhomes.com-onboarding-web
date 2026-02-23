/**
 * 申请列表页面 — Server Component
 *
 * 使用 Supabase Admin Client（Service Role Key）查询 applications 表，
 * 绕过 RLS 限制，按 created_at 倒序排列。
 *
 * Requirements: 3.1, 3.2, 3.4
 */

import { createClient } from "@supabase/supabase-js";
import { ApplicationList } from "@/components/admin/ApplicationList";

export interface ApplicationRow {
  id: string;
  company_name: string;
  contact_email: string;
  contact_phone: string | null;
  city: string | null;
  country: string | null;
  website_url: string | null;
  status: "PENDING" | "CONVERTED" | "REJECTED";
  created_at: string;
}

async function getApplications(): Promise<ApplicationRow[]> {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data, error } = await supabaseAdmin
    .from("applications")
    .select(
      "id, company_name, contact_email, contact_phone, city, country, website_url, status, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch applications: ${error.message}`);
  }

  return (data as ApplicationRow[]) ?? [];
}

export default async function ApplicationsPage() {
  const applications = await getApplications();

  return (
    <div>
      <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-6">
        申请列表
      </h1>

      {applications.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-muted)]">
          暂无申请记录
        </div>
      ) : (
        <ApplicationList applications={applications} />
      )}
    </div>
  );
}

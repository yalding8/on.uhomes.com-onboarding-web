/**
 * 申请列表页面 — Server Component
 *
 * 使用 Supabase Admin Client（Service Role Key）查询 applications 表，
 * 绕过 RLS 限制，按 created_at 倒序排列。
 *
 * Requirements: 3.1, 3.2, 3.4
 */

import { redirect } from "next/navigation";
import { ApplicationList } from "@/components/admin/ApplicationList";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdmin as checkAdmin } from "@/lib/admin/permissions";

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
  const supabaseAdmin = createAdminClient();

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
  // Admin-only: regular BDs cannot view applications
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase
    .from("suppliers")
    .select("contact_email")
    .eq("user_id", user.id)
    .eq("role", "bd")
    .single();
  if (!me || !checkAdmin(me.contact_email)) redirect("/admin/suppliers");

  const applications = await getApplications();

  return (
    <div>
      <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-6">
        Applications
      </h1>

      {applications.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-muted)]">
          No applications yet
        </div>
      ) : (
        <ApplicationList applications={applications} />
      )}
    </div>
  );
}

/**
 * 申请列表页面 — Server Component
 *
 * 使用 Supabase Admin Client（Service Role Key）查询 applications 表，
 * 绕过 RLS 限制，按 created_at 倒序排列。
 */

import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
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
  assigned_bd_id: string | null;
}

export interface BdOption {
  id: string;
  company_name: string;
  contact_email: string;
}

async function getApplications(): Promise<ApplicationRow[]> {
  const supabaseAdmin = createAdminClient();

  const { data, error } = await supabaseAdmin
    .from("applications")
    .select(
      "id, company_name, contact_email, contact_phone, city, country, website_url, status, created_at, assigned_bd_id",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch applications: ${error.message}`);
  }

  return (data as ApplicationRow[]) ?? [];
}

async function getBdUsers(): Promise<BdOption[]> {
  const supabaseAdmin = createAdminClient();

  const { data, error } = await supabaseAdmin
    .from("suppliers")
    .select("id, company_name, contact_email")
    .eq("role", "bd")
    .order("company_name");

  if (error) {
    throw new Error(`Failed to fetch BD users: ${error.message}`);
  }

  return (data as BdOption[]) ?? [];
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

  const [applications, bdUsers] = await Promise.all([
    getApplications(),
    getBdUsers(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">
        Applications
      </h1>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        {applications.length} supplier applications — assign a BD before
        approving.
      </p>

      {applications.length === 0 ? (
        <div className="flex flex-col items-center py-12 px-6 text-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-primary-light)] mb-6">
            <ClipboardList className="h-8 w-8 text-[var(--color-primary)] opacity-60" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
            No Applications Yet
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)] max-w-sm">
            Applications will appear here when suppliers submit the onboarding
            form on the landing page.
          </p>
        </div>
      ) : (
        <ApplicationList applications={applications} bdUsers={bdUsers} />
      )}
    </div>
  );
}

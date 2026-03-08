/**
 * Applications Dashboard — Server Component
 *
 * BD workbench for managing supplier applications.
 * Admin sees all applications; BD sees own + unassigned.
 */

import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { ApplicationList } from "@/components/admin/ApplicationList";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdmin as checkAdmin } from "@/lib/admin/permissions";

export interface ApplicationRow {
  id: string;
  ref_code: string | null;
  company_name: string;
  supplier_type: string | null;
  contact_email: string;
  contact_phone: string | null;
  city: string | null;
  country: string | null;
  website_url: string | null;
  referral_code: string | null;
  status: "PENDING" | "CONVERTING" | "CONVERTED" | "REJECTED";
  created_at: string;
  assigned_bd_id: string | null;
}

export interface BdOption {
  id: string;
  company_name: string;
  contact_email: string;
}

const SELECT_FIELDS =
  "id, ref_code, company_name, supplier_type, contact_email, contact_phone, city, country, website_url, referral_code, status, created_at, assigned_bd_id";

async function getApplications(
  bdId: string | null,
  isAdmin: boolean,
): Promise<ApplicationRow[]> {
  const supabaseAdmin = createAdminClient();

  if (isAdmin) {
    const { data, error } = await supabaseAdmin
      .from("applications")
      .select(SELECT_FIELDS)
      .order("created_at", { ascending: false });
    if (error)
      throw new Error(`Failed to fetch applications: ${error.message}`);
    return (data as ApplicationRow[]) ?? [];
  }

  // BD: own applications + unassigned PENDING
  const [ownRes, unassignedRes] = await Promise.all([
    supabaseAdmin
      .from("applications")
      .select(SELECT_FIELDS)
      .eq("assigned_bd_id", bdId!)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("applications")
      .select(SELECT_FIELDS)
      .eq("status", "PENDING")
      .is("assigned_bd_id", null)
      .order("created_at", { ascending: false }),
  ]);

  if (ownRes.error) throw new Error(ownRes.error.message);
  if (unassignedRes.error) throw new Error(unassignedRes.error.message);

  const own = (ownRes.data as ApplicationRow[]) ?? [];
  const unassigned = (unassignedRes.data as ApplicationRow[]) ?? [];
  // Deduplicate (shouldn't happen, but safety)
  const ids = new Set(own.map((a) => a.id));
  return [...own, ...unassigned.filter((a) => !ids.has(a.id))];
}

async function getBdUsers(): Promise<BdOption[]> {
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("suppliers")
    .select("id, company_name, contact_email")
    .eq("role", "bd")
    .order("company_name");
  if (error) throw new Error(`Failed to fetch BD users: ${error.message}`);
  return (data as BdOption[]) ?? [];
}

export default async function ApplicationsPage() {
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

  if (!me) redirect("/admin/suppliers");

  const isAdmin = checkAdmin(me.contact_email);
  let applications: ApplicationRow[] = [];
  let bdUsers: BdOption[] = [];
  try {
    [applications, bdUsers] = await Promise.all([
      getApplications(me.id, isAdmin),
      getBdUsers(),
    ]);
  } catch (err) {
    console.error("[applications page]", err);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">
        Applications
      </h1>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        {isAdmin
          ? `${applications.length} supplier applications — assign a BD before approving.`
          : "Your assigned applications and available claims."}
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
        <ApplicationList
          applications={applications}
          bdUsers={bdUsers}
          isAdmin={isAdmin}
          currentBdId={me.id}
        />
      )}
    </div>
  );
}

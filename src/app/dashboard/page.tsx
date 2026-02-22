import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Ensure this page works server-side
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-[var(--color-bg-secondary)]">
      <div className="bg-[var(--color-bg-primary)] p-12 rounded-2xl shadow-sm text-center border border-[var(--color-border)]">
        <h1 className="text-3xl font-semibold mb-4 text-[var(--color-text-primary)]">
          Supplier Dashboard
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          Welcome! Based on your email (
          <span className="font-medium text-[var(--color-primary)]">
            {user.email}
          </span>
          ), you are currently in the <strong>PENDING_CONTRACT</strong> stage.
        </p>
      </div>
    </main>
  );
}

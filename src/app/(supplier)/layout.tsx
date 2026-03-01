/**
 * SupplierLayout — 供应商端统一导航壳（Server Component）。
 *
 * 数据流：
 * 1. getUser() → 未登录重定向 /login
 * 2. 查询 suppliers(status) by user_id
 * 3. 无 supplier → 查 applications → 无申请重定向 /
 * 4. 根据 supplier.status 计算 currentStep
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SupplierNav } from "@/components/supplier/SupplierNav";
import { StepIndicator } from "@/components/supplier/StepIndicator";
import { SupplierFooter } from "@/components/supplier/SupplierFooter";
import type { SupplierStep } from "@/components/supplier/types";

interface SupplierLayoutProps {
  children: React.ReactNode;
}

export default async function SupplierLayout({
  children,
}: SupplierLayoutProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 查询 supplier 记录
  const { data: supplier } = await supabase
    .from("suppliers")
    .select("status")
    .eq("user_id", user.id)
    .single();

  let currentStep: SupplierStep;

  if (!supplier) {
    // 无 supplier 记录：检查是否已提交申请
    const admin = createAdminClient();
    const { data: apps } = await admin
      .from("applications")
      .select("id")
      .eq("contact_email", user.email ?? "")
      .limit(1);
    const hasApplication = (apps?.length ?? 0) > 0;
    if (!hasApplication) redirect("/");

    currentStep = "under_review";
  } else if (supplier.status === "PENDING_CONTRACT") {
    currentStep = "sign_contract";
  } else if (supplier.status === "SIGNED") {
    currentStep = "setup_properties";
  } else {
    currentStep = "under_review";
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg-primary)]">
      <SupplierNav email={user.email ?? ""} />
      <StepIndicator currentStep={currentStep} />
      <main className="flex-1 p-4 md:p-8">{children}</main>
      <SupplierFooter />
    </div>
  );
}

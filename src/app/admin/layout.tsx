/**
 * Admin Layout — BD 管理后台布局（Server Component）。
 *
 * 双重保障：中间件已做角色路由守卫，此处再次验证 BD 角色，
 * 防止中间件被绕过时非 BD 用户进入管理后台。
 *
 * Requirements: 2.1, 2.2
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin as checkAdmin } from "@/lib/admin/permissions";
import { Sidebar } from "@/components/admin/Sidebar";
import { MobileSidebar } from "@/components/admin/MobileSidebar";
import { LogoutButton } from "@/components/admin/LogoutButton";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const supabase = await createClient();

  // 1. 获取当前用户
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. 查询 suppliers 表验证 role='bd'（双重保障）
  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id, role, contact_email")
    .eq("user_id", user.id)
    .eq("role", "bd")
    .single();

  if (!supplier) {
    redirect("/dashboard");
  }

  const userIsAdmin = checkAdmin(supplier.contact_email);

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      {/* 顶部栏 */}
      <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 md:px-6 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]">
        <div className="flex items-center gap-2">
          {/* 移动端汉堡菜单按钮 + overlay 面板 */}
          <MobileSidebar isAdmin={userIsAdmin} />
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
            {userIsAdmin ? "Admin" : "BD"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-sm text-[var(--color-text-secondary)]">
            {user.email}
          </span>
          <LogoutButton />
        </div>
      </header>

      {/* 主体：侧边栏 + 内容区 */}
      <div className="flex">
        {/* 桌面端侧边栏 — >=768px 常驻显示 */}
        <aside className="hidden md:block w-56 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] min-h-[calc(100vh-3.5rem)]">
          <Sidebar isAdmin={userIsAdmin} />
        </aside>

        {/* 内容区 */}
        <main className="flex-1 p-4 md:p-6 min-h-[calc(100vh-3.5rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}

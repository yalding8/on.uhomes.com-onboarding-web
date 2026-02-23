"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, Users, UserPlus } from "lucide-react";
import type { ComponentType } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: "申请列表", href: "/admin/applications", icon: Inbox },
  { label: "供应商列表", href: "/admin/suppliers", icon: Users },
  { label: "邀请供应商", href: "/admin/invite", icon: UserPlus },
];

interface SidebarProps {
  /** 点击导航项后的回调，移动端用于关闭菜单 */
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-4">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-[var(--color-primary-light)] text-[var(--color-primary)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

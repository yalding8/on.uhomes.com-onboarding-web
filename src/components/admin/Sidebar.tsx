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

const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: "Applications", href: "/admin/applications", icon: Inbox },
  { label: "Suppliers", href: "/admin/suppliers", icon: Users },
  { label: "Invite Supplier", href: "/admin/invite", icon: UserPlus },
];

const BD_NAV_ITEMS: NavItem[] = [
  { label: "My Suppliers", href: "/admin/suppliers", icon: Users },
  { label: "Invite Supplier", href: "/admin/invite", icon: UserPlus },
];

interface SidebarProps {
  isAdmin?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ isAdmin = false, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const items = isAdmin ? ADMIN_NAV_ITEMS : BD_NAV_ITEMS;

  return (
    <nav className="flex flex-col gap-1 p-4">
      {items.map((item) => {
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

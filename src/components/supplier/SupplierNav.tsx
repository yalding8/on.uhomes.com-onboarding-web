import Link from "next/link";
import { LogoutButton } from "@/components/admin/LogoutButton";

interface SupplierNavProps {
  email: string;
}

export function SupplierNav({ email }: SupplierNavProps) {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/dashboard" className="font-bold text-lg tracking-tight">
          <span className="text-[var(--color-primary)]">uhomes.com</span>
          <span className="text-[var(--color-text-primary)] ms-2">
            Partners
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-sm text-[var(--color-text-secondary)] truncate max-w-[200px]">
            {email}
          </span>
          <LogoutButton />
        </div>
      </div>
    </nav>
  );
}

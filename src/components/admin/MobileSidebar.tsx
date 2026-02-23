"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./Sidebar";

/**
 * 移动端侧边栏 — 汉堡菜单按钮 + overlay + 滑出导航面板。
 * 仅在 <768px 时可见（md:hidden）。
 *
 * Requirements: 2.3, 2.4
 */
export function MobileSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const close = useCallback(() => setIsOpen(false), []);

  // 路由变化时自动关闭（浏览器前进/后退）
  useEffect(() => {
    close();
  }, [pathname, close]);

  return (
    <>
      {/* 汉堡按钮 — 仅移动端可见 */}
      <button
        type="button"
        aria-label={isOpen ? "关闭导航菜单" : "打开导航菜单"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="md:hidden p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Overlay + 侧边栏面板 */}
      {isOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* 半透明遮罩 */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={close}
            aria-hidden="true"
          />

          {/* 侧边栏面板 */}
          <aside className="relative w-64 max-w-[80vw] h-full bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] shadow-lg">
            <div className="flex items-center justify-between h-14 px-4 border-b border-[var(--color-border)]">
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                导航
              </span>
              <button
                type="button"
                aria-label="关闭导航菜单"
                onClick={close}
                className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <Sidebar onNavigate={close} />
          </aside>
        </div>
      )}
    </>
  );
}

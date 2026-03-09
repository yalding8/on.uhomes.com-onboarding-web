"use client";

import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils/relative-time";

interface Notification {
  id: string;
  title: string;
  body: string;
  category: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications")
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          data: { notifications: Notification[]; unreadCount: number } | null,
        ) => {
          if (cancelled || !data) return;
          setNotifications(data.notifications);
          setUnreadCount(data.unreadCount);
        },
      )
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Close panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));

    try {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    } catch {
      // Already optimistically updated
    }
  };

  const handleNotificationClick = (n: Notification) => {
    if (!n.is_read) markAsRead(n.id);
    if (n.link) window.location.assign(n.link);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-[var(--color-text-secondary)]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-primary)] text-white text-[10px] font-bold px-1">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-lg z-50">
          <div className="p-3 border-b border-[var(--color-border)]">
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Notifications
            </h4>
          </div>

          {notifications.length === 0 ? (
            <div className="p-6 text-center">
              <Bell className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-2 opacity-40" />
              <p className="text-sm text-[var(--color-text-muted)]">
                No notifications yet
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full text-start p-3 hover:bg-[var(--color-bg-secondary)] transition-colors ${
                    !n.is_read ? "bg-[var(--color-primary-light)]/30" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--color-primary)]" />
                    )}
                    <div className={n.is_read ? "ms-4" : ""}>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        {n.title}
                      </p>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        {formatRelativeTime(n.created_at)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

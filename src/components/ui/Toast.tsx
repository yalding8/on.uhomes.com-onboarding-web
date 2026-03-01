"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { CheckCircle, XCircle, AlertTriangle, X } from "lucide-react";

type ToastType = "success" | "error" | "warning";

interface ToastMessage {
  id: number;
  type: ToastType;
  text: string;
}

const ICONS: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
};

const COLORS: Record<ToastType, { bg: string; text: string; icon: string }> = {
  success: {
    bg: "var(--color-success-light)",
    text: "var(--color-text-primary)",
    icon: "var(--color-success)",
  },
  error: {
    bg: "var(--color-primary-light)",
    text: "var(--color-text-primary)",
    icon: "var(--color-primary)",
  },
  warning: {
    bg: "var(--color-primary-light)",
    text: "var(--color-text-primary)",
    icon: "var(--color-warning)",
  },
};

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, text: string, duration = 4000) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, type, text }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss],
  );

  return { toasts, toast, dismiss };
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: (id: number) => void;
}) {
  const [visible, setVisible] = useState(false);
  const colors = COLORS[toast.type];
  const Icon = ICONS[toast.type];

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-[var(--color-border)] px-4 py-3 shadow-lg transition-all duration-300"
      style={{
        backgroundColor: colors.bg,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(1rem)",
      }}
    >
      <Icon
        className="w-4 h-4 mt-0.5 shrink-0"
        style={{ color: colors.icon }}
      />
      <p className="text-sm flex-1" style={{ color: colors.text }}>
        {toast.text}
      </p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 p-0.5 rounded hover:opacity-70 transition-opacity"
        style={{ color: colors.text }}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

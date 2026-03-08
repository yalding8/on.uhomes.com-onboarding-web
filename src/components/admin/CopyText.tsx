"use client";

import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";

export function CopyText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    },
    [text],
  );
  return (
    <button
      onClick={handleCopy}
      className="group inline-flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors"
      title={`Copy ${text}`}
    >
      <span>{text}</span>
      {copied ? (
        <Check className="h-3 w-3 text-[var(--color-success)]" />
      ) : (
        <Copy className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
      )}
    </button>
  );
}

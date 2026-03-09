"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils/relative-time";

interface Note {
  id: string;
  author_email: string;
  content: string;
  created_at: string;
}

export function SupplierNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch("/api/suppliers/notes");
      if (!res.ok) return;
      const data = (await res.json()) as { notes: Note[] };
      setNotes(data.notes);
    } catch {
      // Silently fail — non-critical UI
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  if (loading) return null;
  if (notes.length === 0) return null;

  return (
    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-[var(--color-bg-primary)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[var(--color-primary-light)] rounded-lg text-[var(--color-primary)]">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div className="text-start">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Messages from Your BD Manager
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              {notes.length} message{notes.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-[var(--color-border)] divide-y divide-[var(--color-border)]">
          {notes.map((note) => (
            <div key={note.id} className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                  {note.author_email}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {formatRelativeTime(note.created_at)}
                </span>
              </div>
              <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">
                {note.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

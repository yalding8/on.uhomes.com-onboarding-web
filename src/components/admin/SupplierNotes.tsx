"use client";

/**
 * Supplier follow-up notes component.
 * Displays note history and allows adding new notes.
 */

import { useEffect, useState, useCallback } from "react";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils/relative-time";

interface Note {
  id: string;
  author_email: string;
  content: string;
  created_at: string;
}

interface SupplierNotesProps {
  supplierId: string;
  canEdit: boolean;
}

export function SupplierNotes({ supplierId, canEdit }: SupplierNotesProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/suppliers/${supplierId}/notes`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = (await res.json()) as { notes: Note[] };
      setNotes(data.notes);
    } catch {
      setError("Failed to load notes");
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/suppliers/${supplierId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to add note");
      }

      const data = (await res.json()) as { note: Note };
      setNotes((prev) => [data.note, ...prev]);
      setInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <MessageSquare className="h-3.5 w-3.5" />
        Follow-up Notes
      </p>

      {/* Input area */}
      {canEdit && (
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Add a note..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            disabled={submitting}
            maxLength={2000}
            className="flex-1 text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 disabled:opacity-60 transition-colors"
          />
          <button
            onClick={handleSubmit}
            disabled={submitting || !input.trim()}
            className="px-3 py-2 rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-[var(--color-warning)] mb-3">{error}</p>
      )}

      {/* Notes list */}
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-[var(--color-text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading notes...
        </div>
      ) : notes.length === 0 ? (
        <div className="py-4 text-center">
          <MessageSquare className="h-6 w-6 text-[var(--color-text-muted)] opacity-40 mx-auto mb-2" />
          <p className="text-sm text-[var(--color-text-muted)]">
            No follow-up notes yet
          </p>
          {canEdit && (
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Add a note to track your communication
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {notes.map((note) => (
            <div
              key={note.id}
              className="text-sm border-s-2 border-[var(--color-border)] ps-3"
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-medium text-[var(--color-text-primary)] text-xs">
                  {note.author_email}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {formatRelativeTime(note.created_at)}
                </span>
              </div>
              <p className="text-[var(--color-text-secondary)] break-words">
                {note.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

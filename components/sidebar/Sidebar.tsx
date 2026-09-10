'use client';

import { useEffect, useState } from 'react';
import type { ConversationSummary } from '@/lib/client/types';

interface Props {
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose?: () => void;
}

export function Sidebar({ conversations, activeId, onSelect, onNew, onDelete, onClose }: Props) {
  // Bestätigung direkt in der Liste statt window.confirm — Dialoge werden in
  // eingebetteten Ansichten unterdrückt, wodurch das Löschen wirkungslos blieb.
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingId) return;
    const timer = window.setTimeout(() => setPendingId(null), 5000);
    return () => window.clearTimeout(timer);
  }, [pendingId]);

  return (
    <nav className="flex h-full w-full flex-col border-r border-border/80 bg-surface/90 backdrop-blur-md" aria-label="Unterhaltungen">
      <div className="border-b border-border/70 px-3 pb-3 pt-3">
        <p className="font-display mb-2 px-0.5 text-xs font-semibold tracking-wide text-muted">Chats</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNew}
            className="flex-1 rounded-xl border border-border bg-bg/70 px-3 py-2 text-sm font-medium transition hover:border-accent hover:bg-bg"
          >
            + Neuer Chat
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-2.5 py-2 text-sm lg:hidden"
              aria-label="Seitenleiste schließen"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <ul className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3 pt-2">
        {conversations.length === 0 && (
          <li className="px-2 py-3 text-xs text-muted">Noch keine Unterhaltungen.</li>
        )}
        {conversations.map((conversation) => {
          const pending = pendingId === conversation.id;
          return (
            <li key={conversation.id} className="group relative">
              <button
                type="button"
                onClick={() => onSelect(conversation.id)}
                className={`w-full truncate rounded-lg px-2.5 py-2 pr-20 text-left text-sm ${
                  activeId === conversation.id ? 'bg-bg font-medium' : 'hover:bg-bg'
                }`}
                title={conversation.title}
              >
                {conversation.title}
              </button>
              {pending ? (
                <span className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPendingId(null);
                      onDelete(conversation.id);
                    }}
                    className="rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-medium text-white hover:bg-red-700"
                  >
                    Löschen
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingId(null)}
                    className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted hover:bg-bg"
                    aria-label="Abbrechen"
                  >
                    ✕
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setPendingId(conversation.id)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-xs text-muted hover:bg-border hover:text-fg"
                  aria-label={`${conversation.title} löschen`}
                >
                  ✕
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

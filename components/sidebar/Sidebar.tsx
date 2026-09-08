'use client';

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
  return (
    <nav className="flex h-full flex-col border-r border-border bg-surface" aria-label="Unterhaltungen">
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={onNew}
          className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-bg"
        >
          + Neuer Chat
        </button>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-2.5 py-2 text-sm lg:hidden" aria-label="Seitenleiste schließen">
            ✕
          </button>
        )}
      </div>

      <ul className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {conversations.length === 0 && (
          <li className="px-2 py-3 text-xs text-muted">Noch keine Unterhaltungen.</li>
        )}
        {conversations.map((conversation) => (
          <li key={conversation.id} className="group relative">
            <button
              type="button"
              onClick={() => onSelect(conversation.id)}
              className={`w-full truncate rounded-lg px-2.5 py-2 pr-8 text-left text-sm ${
                activeId === conversation.id ? 'bg-bg font-medium' : 'hover:bg-bg'
              }`}
              title={conversation.title}
            >
              {conversation.title}
            </button>
            <button
              type="button"
              onClick={() => onDelete(conversation.id)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-xs text-muted opacity-0 hover:bg-border focus:opacity-100 group-hover:opacity-100"
              aria-label={`${conversation.title} löschen`}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

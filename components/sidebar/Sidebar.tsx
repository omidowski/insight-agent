'use client';

import { useEffect, useRef, useState } from 'react';
import type { ConversationSummary, Mode } from '@/lib/client/types';
import type {
  ResearchDepth,
  ResearchOptions,
  ResearchOutputFormat,
  ResearchTimeframe,
} from '@/lib/contracts/domain';
import {
  RESEARCH_MODES,
  getResearchMode,
  TIMEFRAME_LABELS,
  DEPTH_LABELS,
  OUTPUT_FORMAT_LABELS,
  type BadgeTone,
} from '@/lib/client/research-modes';

interface Props {
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename?: (id: string, newTitle: string) => void;
  onClose?: () => void;
  mode?: Mode;
  onModeChange?: (mode: Mode) => void;
  researchOptions?: ResearchOptions;
  onOptionsChange?: (options: ResearchOptions) => void;
}

function getBadgeStyle(tone: BadgeTone, isActive: boolean): string {
  switch (tone) {
    case 'purple':
      return isActive
        ? 'bg-purple-500/25 text-purple-300 border-purple-400/50 shadow-[0_0_8px_rgba(168,85,247,0.3)]'
        : 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    case 'amber':
      return isActive
        ? 'bg-amber-500/25 text-amber-300 border-amber-400/50 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
        : 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'cyan':
      return isActive
        ? 'bg-cyan-500/25 text-cyan-300 border-cyan-400/50 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
        : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
    case 'emerald':
      return isActive
        ? 'bg-emerald-500/25 text-emerald-300 border-emerald-400/50 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'blue':
      return isActive
        ? 'bg-blue-500/25 text-blue-300 border-blue-400/50 shadow-[0_0_8px_rgba(59,130,246,0.3)]'
        : 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'muted':
      return isActive
        ? 'bg-surface text-fg border-border shadow-xs'
        : 'bg-surface/60 text-muted border-border/50';
    case 'accent':
    default:
      return isActive
        ? 'bg-accent/25 text-accent border-accent/50 shadow-[0_0_8px_rgba(var(--accent)/0.3)]'
        : 'bg-accent/10 text-accent border-accent/20';
  }
}

export function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onClose,
  mode = 'auto',
  onModeChange,
  researchOptions = {},
  onOptionsChange,
}: Props) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [modesExpanded, setModesExpanded] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  const activeModeConfig = getResearchMode(mode);

  useEffect(() => {
    if (!pendingId) return;
    const timer = window.setTimeout(() => setPendingId(null), 5000);
    return () => window.clearTimeout(timer);
  }, [pendingId]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const startEditing = (id: string, currentTitle: string) => {
    setPendingId(null);
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const commitEditing = (id: string) => {
    const trimmed = editTitle.trim();
    if (trimmed && onRename) {
      onRename(id, trimmed);
    }
    setEditingId(null);
  };

  const handleSelectMode = (newMode: Mode) => {
    if (onModeChange) {
      onModeChange(newMode);
    }
  };

  const updateOption = <K extends keyof ResearchOptions>(key: K, value: ResearchOptions[K]) => {
    if (!onOptionsChange) return;
    const next = { ...researchOptions };
    if (value === undefined || value === 'all' || (key === 'depth' && value === 'standard') || (key === 'outputFormat' && value === 'standard')) {
      delete next[key];
    } else {
      next[key] = value;
    }
    onOptionsChange(next);
  };

  const hasCustomFilters = Boolean(
    researchOptions.depth ||
    (researchOptions.timeframe && researchOptions.timeframe !== 'all') ||
    (researchOptions.outputFormat && researchOptions.outputFormat !== 'standard')
  );

  return (
    <nav
      className="relative flex h-full w-full flex-col border-r border-border/80 bg-surface/90 shadow-[8px_0_32px_-6px_rgba(0,0,0,0.18)] backdrop-blur-xl"
      aria-label="Unterhaltungen und Recherche-Modi"
    >
      {/* 1. Header & New Chat */}
      <div className="relative border-b border-border/70 px-3 pb-3 pt-3">
        <div className="animated-line absolute bottom-0 left-0 right-0 h-[2px] opacity-60" />
        <div className="mb-2 flex items-center justify-between px-0.5">
          <p className="font-display text-xs font-bold uppercase tracking-wider text-muted">Insight Agent</p>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border/80 p-1 text-xs text-muted hover:border-accent hover:text-fg lg:hidden"
              aria-label="Seitenleiste schließen"
            >
              ✕
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onNew}
          className="group relative w-full rounded-xl border border-border/80 bg-surface/80 px-3.5 py-2 text-sm font-semibold shadow-xs transition-all hover:border-accent hover:bg-surface hover:text-accent hover:shadow-[0_0_18px_rgb(var(--accent)/0.2)]"
        >
          <span className="flex items-center justify-center gap-1.5">
            <span className="font-bold text-accent transition-transform group-hover:scale-110">+</span>
            <span>Neuer Chat</span>
          </span>
        </button>
      </div>

      {/* 2. Research Modes Section */}
      <div className="border-b border-border/70 bg-surface/40 px-3 py-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setModesExpanded((prev) => !prev)}
            className="flex items-center gap-1.5 text-left transition hover:text-fg"
            title={modesExpanded ? 'Modusliste einklappen' : 'Modusliste ausklappen'}
          >
            <p className="font-display text-xs font-bold uppercase tracking-wider text-muted">
              Recherche-Modus
            </p>
            <span className="text-[10px] text-muted transition-transform">
              {modesExpanded ? '▾' : '▸'}
            </span>
          </button>
          <div className="flex items-center gap-1">
            <span
              className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold transition ${getBadgeStyle(
                activeModeConfig.badgeTone,
                true,
              )}`}
            >
              {activeModeConfig.icon} {activeModeConfig.shortName}
            </span>
          </div>
        </div>

        {modesExpanded ? (
          <div className="space-y-1 pt-1">
            {RESEARCH_MODES.map((m) => {
              const isSelected = mode === m.id || (mode === 'research' && m.id === 'deep_research');
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelectMode(m.id)}
                  className={`group relative flex w-full items-start gap-2 rounded-xl p-2 text-left transition-all ${
                    isSelected
                      ? 'border border-accent/60 bg-accent/10 font-medium text-fg shadow-[0_0_12px_rgb(var(--accent)/0.15)] ring-1 ring-accent/30'
                      : 'border border-transparent bg-transparent text-fg/80 hover:border-border/60 hover:bg-surface/80 hover:text-fg'
                  }`}
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-surface text-sm shadow-xs group-hover:scale-105 transition-transform">
                    {m.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`truncate text-xs font-semibold ${isSelected ? 'text-accent' : 'text-fg'}`}>
                        {m.name}
                      </span>
                      <span
                        className={`shrink-0 rounded border px-1.5 py-0.2 text-[9px] font-medium ${getBadgeStyle(
                          m.badgeTone,
                          isSelected,
                        )}`}
                      >
                        {m.badge}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-muted">
                      {m.shortDesc}
                    </p>
                  </div>
                  {isSelected && (
                    <span className="mt-1 flex h-2 w-2 shrink-0 rounded-full bg-accent shadow-[0_0_6px_rgb(var(--accent))]" />
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div
            onClick={() => setModesExpanded(true)}
            className="group flex cursor-pointer items-center justify-between rounded-xl border border-accent/40 bg-accent/10 p-2 transition hover:bg-accent/15"
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{activeModeConfig.icon}</span>
              <div>
                <p className="text-xs font-semibold text-fg">{activeModeConfig.name}</p>
                <p className="line-clamp-1 text-[11px] text-muted">{activeModeConfig.shortDesc}</p>
              </div>
            </div>
            <span className="text-[11px] text-accent group-hover:underline">Ändern ▾</span>
          </div>
        )}

        {/* Optionale Feinjustierung / Filter-Drawer */}
        {onOptionsChange && (
          <div className="mt-2 pt-1 border-t border-border/50">
            <button
              type="button"
              onClick={() => setFiltersOpen((prev) => !prev)}
              className="flex w-full items-center justify-between py-1 text-[11px] text-muted transition hover:text-fg"
            >
              <span className="flex items-center gap-1 font-medium">
                <span>⚙️ Optionen & Filter</span>
                {hasCustomFilters && (
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" title="Aktive Filter vorhanden" />
                )}
              </span>
              <span className="text-[10px]">{filtersOpen ? '▲' : '▼'}</span>
            </button>

            {filtersOpen && (
              <div className="mt-1 space-y-2.5 rounded-xl border border-border/60 bg-surface/90 p-2.5 text-xs">
                {/* Recherche-Tiefe */}
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">
                    Recherche-Tiefe
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['quick', 'standard', 'deep'] as ResearchDepth[]).map((d) => {
                      const active = (researchOptions.depth ?? 'standard') === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => updateOption('depth', d)}
                          className={`rounded-lg border px-1.5 py-1 text-center text-[10px] font-medium transition ${
                            active
                              ? 'border-accent bg-accent/15 text-accent font-semibold shadow-xs'
                              : 'border-border/70 bg-surface/50 text-muted hover:border-border hover:text-fg'
                          }`}
                        >
                          {DEPTH_LABELS[d].label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Zeitraum */}
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">
                    Zeitraum
                  </label>
                  <select
                    value={researchOptions.timeframe ?? 'all'}
                    onChange={(e) => updateOption('timeframe', e.target.value as ResearchTimeframe)}
                    className="w-full rounded-lg border border-border/80 bg-surface px-2 py-1 text-[11px] text-fg outline-none focus:border-accent"
                  >
                    {(['all', 'day', 'week', 'month', 'year'] as ResearchTimeframe[]).map((tf) => (
                      <option key={tf} value={tf}>
                        {TIMEFRAME_LABELS[tf]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Ausgabeformat */}
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">
                    Ausgabeformat
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    {(['standard', 'detailed_report', 'comparison_table', 'bullet_points'] as ResearchOutputFormat[]).map(
                      (f) => {
                        const active = (researchOptions.outputFormat ?? 'standard') === f;
                        return (
                          <button
                            key={f}
                            type="button"
                            onClick={() => updateOption('outputFormat', f)}
                            className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-left text-[10px] font-medium transition ${
                              active
                                ? 'border-accent bg-accent/15 text-accent font-semibold shadow-xs'
                                : 'border-border/70 bg-surface/50 text-muted hover:border-border hover:text-fg'
                            }`}
                          >
                            <span>{OUTPUT_FORMAT_LABELS[f].icon}</span>
                            <span className="truncate">{OUTPUT_FORMAT_LABELS[f].label}</span>
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>

                {hasCustomFilters && (
                  <button
                    type="button"
                    onClick={() => onOptionsChange({})}
                    className="w-full rounded border border-border/60 py-0.5 text-center text-[10px] text-muted hover:text-fg"
                  >
                    Filter zurücksetzen
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Conversation History List */}
      <div className="flex-1 overflow-y-auto px-2.5 pb-4 pt-2">
        <div className="mb-1.5 flex items-center justify-between px-1">
          <p className="font-display text-xs font-bold uppercase tracking-wider text-muted">
            Unterhaltungen ({conversations.length})
          </p>
        </div>

        <ul className="space-y-1">
          {conversations.length === 0 && (
            <li className="px-3 py-4 text-xs text-muted">Noch keine Unterhaltungen vorhanden.</li>
          )}
          {conversations.map((conversation) => {
            const pending = pendingId === conversation.id;
            const editing = editingId === conversation.id;
            const isActive = activeId === conversation.id;

            if (editing) {
              return (
                <li key={conversation.id} className="px-1 py-1">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      commitEditing(conversation.id);
                    }}
                    className="flex items-center gap-1"
                  >
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value.slice(0, 120))}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onBlur={() => commitEditing(conversation.id)}
                      className="w-full rounded-xl border border-accent bg-surface px-3 py-1.5 text-sm shadow-[0_0_14px_rgb(var(--accent)/0.3)] outline-none ring-1 ring-accent"
                      aria-label="Titel bearbeiten"
                    />
                  </form>
                </li>
              );
            }

            return (
              <li key={conversation.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelect(conversation.id)}
                  onDoubleClick={() => onRename && startEditing(conversation.id, conversation.title)}
                  className={`relative w-full truncate rounded-xl px-3 py-2 pr-16 text-left text-sm transition-all ${
                    isActive
                      ? 'border border-accent/40 bg-surface font-semibold text-fg shadow-[0_4px_18px_-2px_rgba(0,0,0,0.12),0_0_16px_rgb(var(--accent)/0.15)]'
                      : 'border border-transparent text-fg/80 hover:border-border/60 hover:bg-surface/70 hover:text-fg hover:shadow-xs'
                  }`}
                  title={conversation.title}
                >
                  {isActive && (
                    <span className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full bg-accent shadow-[0_0_10px_rgb(var(--accent))]" />
                  )}
                  <span className={isActive ? 'pl-1' : ''}>{conversation.title}</span>
                </button>
                {pending ? (
                  <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPendingId(null);
                        onDelete(conversation.id);
                      }}
                      className="rounded-lg bg-red-600 px-2 py-1 text-[11px] font-semibold text-white shadow-xs hover:bg-red-700"
                    >
                      Löschen
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingId(null)}
                      className="rounded-lg border border-border px-2 py-1 text-[11px] text-muted hover:bg-bg"
                      aria-label="Abbrechen"
                    >
                      ✕
                    </button>
                  </span>
                ) : (
                  <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {onRename && (
                      <button
                        type="button"
                        onClick={() => startEditing(conversation.id, conversation.title)}
                        className="rounded-md p-1.5 text-xs text-muted shadow-xs hover:bg-border/60 hover:text-fg"
                        title="Titel bearbeiten"
                        aria-label={`${conversation.title} umbenennen`}
                      >
                        ✎
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPendingId(conversation.id)}
                      className="rounded-md p-1.5 text-xs text-muted shadow-xs hover:bg-border/60 hover:text-fg"
                      aria-label={`${conversation.title} löschen`}
                      title="Löschen"
                    >
                      ✕
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* 4. Bottom Footer Info Bar */}
      <div className="border-t border-border/70 bg-surface/60 px-3 py-2 text-[11px] text-muted backdrop-blur-md">
        <div className="flex items-center justify-between">
          <span className="truncate">
            Aktiv: <strong className="text-fg">{activeModeConfig.name}</strong>
          </span>
          <span className="rounded bg-bg/80 px-1.5 py-0.5 font-mono text-[9px] text-muted border border-border/50">
            {activeModeConfig.badge}
          </span>
        </div>
      </div>
    </nav>
  );
}

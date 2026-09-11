'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { api } from '@/lib/client/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchItem {
  id: string;
  entityType: string;
  entityId: string;
  parentId: string | null;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
  createdAt: string;
}

interface VectorStats {
  total: number;
  byType: Record<string, number>;
  dimensions: number;
  model: string;
  lastUpdatedAt: string | null;
}

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  prompt: { label: 'Prompt', icon: '⚡', color: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30' },
  message: { label: 'Nachricht', icon: '💬', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30' },
  source: { label: 'Quelle', icon: '🌐', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
  excerpt: { label: 'Beleg', icon: '📌', color: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30' },
  conflict: { label: 'Konflikt', icon: '⚠️', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' },
  citation: { label: 'Zitat', icon: '🔖', color: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30' },
  tool_call: { label: 'Tool', icon: '🛠️', color: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30' },
  run: { label: 'Lauf', icon: '🔄', color: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30' },
  step: { label: 'Schritt', icon: '📋', color: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30' },
};

const ALL_FILTER_TABS = [
  { id: 'all', label: 'Alle' },
  { id: 'prompt', label: 'Prompts' },
  { id: 'message', label: 'Nachrichten' },
  { id: 'source', label: 'Quellen' },
  { id: 'excerpt', label: 'Belege' },
  { id: 'conflict', label: 'Konflikte' },
  { id: 'citation', label: 'Zitate' },
  { id: 'tool_call', label: 'Tools' },
  { id: 'run', label: 'Läufe' },
];

export function VectorSearchModal({ isOpen, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [results, setResults] = useState<SearchItem[]>([]);
  const [stats, setStats] = useState<VectorStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const loadStats = useCallback(async () => {
    try {
      const data = await api.getVectorStats();
      if (data.ok) setStats(data.stats);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void loadStats();
    }
  }, [isOpen, loadStats]);

  // Escape key zum Schließen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Semantische Suche debounced ausführen
  useEffect(() => {
    if (!isOpen || !query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const types = selectedType === 'all' ? undefined : [selectedType];
        const res = await api.vectorSearch(query.trim(), { types, limit: 15 });
        if (res.ok) {
          startTransition(() => {
            setResults(res.results);
          });
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, selectedType, isOpen]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await api.syncVectorDb();
      if (res.ok) {
        setSyncMessage(`✓ ${res.indexed} Einträge synchronisiert (${res.durationMs}ms)`);
        await loadStats();
      }
    } catch (err) {
      setSyncMessage('Fehler bei der Synchronisierung');
    } finally {
      setSyncing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative z-10 flex h-full max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl border border-border/80 bg-surface shadow-2xl overflow-hidden">
        {/* Header */}
        <header className="relative border-b border-border/70 bg-surface/90 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/15 text-accent text-sm font-bold shadow-[0_0_12px_rgb(var(--accent)/0.3)]">
                🧠
              </span>
              <div>
                <h2 className="text-base font-bold tracking-tight text-fg">Vector DB & Semantische Suche</h2>
                <p className="text-xs text-muted">
                  Vektordatenbank über alle generierten Prompts, Nachrichten, Quellen, Belege und Artefakte
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-fg hover:bg-surface-3 transition-colors disabled:opacity-50"
              >
                <span className={syncing ? 'animate-spin' : ''}>🔄</span>
                {syncing ? 'Indexiere...' : 'Sync All'}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg transition-colors"
                title="Schließen (Esc)"
              >
                ✕
              </button>
            </div>
          </div>

          {syncMessage && (
            <div className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {syncMessage}
            </div>
          )}

          {/* Stats Bar */}
          {stats && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/40 pt-2.5 text-[11px] text-muted">
              <span className="font-semibold text-fg">
                {stats.total} Vektoren
              </span>
              <span>· Modell: {stats.model} ({stats.dimensions}d)</span>
              {Object.entries(stats.byType).map(([type, count]) => {
                if (count === 0) return null;
                const conf = TYPE_CONFIG[type] ?? { label: type, icon: '•', color: '' };
                return (
                  <span
                    key={type}
                    className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5"
                  >
                    <span>{conf.icon}</span>
                    <span>{count} {conf.label}</span>
                  </span>
                );
              })}
            </div>
          )}
        </header>

        {/* Search Bar & Filters */}
        <div className="border-b border-border/70 bg-surface-2/50 px-6 py-3 space-y-3">
          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-muted text-sm">🔍</span>
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Suche semantisch nach Fragen, Prompt-Strategien, Quelleninhalten, Fakten..."
              className="w-full rounded-xl border border-border bg-surface pl-10 pr-10 py-2 text-sm text-fg placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            {loading && (
              <span className="absolute right-3.5 animate-spin text-muted text-xs">⌛</span>
            )}
            {query && !loading && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3.5 text-muted hover:text-fg text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Type Filter Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {ALL_FILTER_TABS.map((tab) => {
              const active = selectedType === tab.id;
              const count = tab.id === 'all' ? stats?.total : stats?.byType[tab.id];
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedType(tab.id)}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-accent text-accent-fg shadow-sm'
                      : 'bg-surface border border-border/70 text-muted hover:bg-surface-3 hover:text-fg'
                  }`}
                >
                  <span>{tab.label}</span>
                  {count !== undefined && count > 0 && (
                    <span className={`rounded-full px-1 text-[10px] ${active ? 'bg-accent-fg/20 text-accent-fg' : 'bg-surface-2 text-muted'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {query.trim().length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-2xl mb-3">
                ⚡
              </div>
              <h3 className="text-sm font-semibold text-fg">Semantische Suche im Vector Store</h3>
              <p className="mt-1 max-w-md text-xs text-muted">
                Gib einen Begriff oder Satz ein, um über Vektor-Ähnlichkeit passende Prompts,
                Nachrichten, Zitate, extrahierte Webquellen oder Konflikte zu finden.
              </p>
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-2xl mb-3">
                🔍
              </div>
              <h3 className="text-sm font-semibold text-fg">Keine passenden Vektoren gefunden</h3>
              <p className="mt-1 text-xs text-muted">
                Versuche andere Begriffe oder synchronisiere die Datenbank mit „Sync All“.
              </p>
            </div>
          ) : (
            results.map((item) => {
              const conf = TYPE_CONFIG[item.entityType] ?? {
                label: item.entityType,
                icon: '📄',
                color: 'bg-surface-2 text-muted border-border',
              };
              const pct = Math.round(item.similarity * 100);
              const scoreColor =
                pct >= 80
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : pct >= 50
                    ? 'border-teal-500/30 bg-teal-500/10 text-teal-600 dark:text-teal-400'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400';

              return (
                <div
                  key={item.id}
                  className="group rounded-xl border border-border bg-surface p-4 hover:border-accent/40 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${conf.color}`}
                      >
                        <span>{conf.icon}</span>
                        <span>{conf.label}</span>
                      </span>
                      <span className="text-[11px] font-mono text-muted">
                        ID: {item.entityId}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${scoreColor}`}
                      >
                        {pct}% Ähnlichkeit
                      </span>
                    </div>
                  </div>

                  {/* Content snippet */}
                  <div className="rounded-lg bg-surface-2/60 p-3 text-xs leading-relaxed text-fg font-sans whitespace-pre-wrap max-h-48 overflow-y-auto border border-border/40">
                    {item.content}
                  </div>

                  {/* Metadata Chips */}
                  {item.metadata && Object.keys(item.metadata).length > 0 && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                      {Object.entries(item.metadata).map(([k, v]) => {
                        if (v === null || v === undefined || typeof v === 'object') return null;
                        return (
                          <span
                            key={k}
                            className="rounded bg-surface-3 px-1.5 py-0.5 font-mono"
                          >
                            {k}: {String(v).slice(0, 40)}
                          </span>
                        );
                      })}
                      <span className="ml-auto text-[10px] text-muted">
                        {new Date(item.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <footer className="border-t border-border/70 bg-surface-2/50 px-6 py-2.5 text-right text-xs text-muted">
          <span>Tipp: Der Agent nutzt dieses Vector DB automatisch als Werkzeug <code>vector_search</code> bei Recherchen.</span>
        </footer>
      </div>
    </div>
  );
}

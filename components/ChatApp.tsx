'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, openRunStream } from '@/lib/client/api';
import type { ConversationSummary, Mode, MessageView } from '@/lib/client/types';
import type { Conflict, ExcerptRecord, SourceRecord, ResearchOptions } from '@/lib/contracts/domain';
import { activityReducer, initialActivityState, type ActivityState } from '@/lib/client/activity-reducer';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ActivityCard } from '@/components/activity/ActivityCard';
import { SourcesPanel } from '@/components/sources/SourcesPanel';
import { DigitalIdPanel } from '@/components/profile/DigitalIdPanel';
import { Markdown } from '@/components/chat/Markdown';
import { ResearchControls } from '@/components/chat/ResearchControls';
import { VectorSearchModal } from '@/components/vector/VectorSearchModal';
import {
  RESEARCH_MODES,
  getResearchMode,
  TIMEFRAME_LABELS,
  DEPTH_LABELS,
  OUTPUT_FORMAT_LABELS,
} from '@/lib/client/research-modes';

interface ModelInfo {
  id: string;
  recommended: boolean;
  note?: string;
}

interface Props {
  configured: boolean;
  searchConfigured: boolean;
  provider: string;
  showCosts: boolean;
}

const PROVIDER_LABEL: Record<string, string> = {
  openai: 'OpenAI',
  hermes: 'Hermes',
  compatible: 'OpenAI-kompatibel',
};

const SEARCH_EXAMPLES = [
  { icon: '🔍', text: 'Neueste Durchbrüche und Modelle in der KI-Forschung 2025' },
  { icon: '⚖️', text: 'Vergleich lokaler LLMs (Ollama / Hermes) vs. Cloud APIs' },
  { icon: '📊', text: 'Aktuelle Markttrends und Investitionen in CleanTech' },
  { icon: '📑', text: 'Umfassendes Briefing zu Quantencomputing-Architekturen' },
];

const SAY_EXAMPLES = [
  { icon: '💬', text: 'Lass uns eine Markteinführungsstrategie für ein B2B-Tool erarbeiten' },
  { icon: '✍️', text: 'Hilf mir, einen präzisen und überzeugenden Projektantrag zu schreiben' },
  { icon: '🧠', text: 'Erkläre mir komplexe adaptive Systeme anhand greifbarer Alltagsbeispiele' },
  { icon: '🎯', text: 'Gib mir ehrliches Feedback und Gegenargumente zu meiner Geschäftsidee' },
];

const AUTO_EXAMPLES = [
  { icon: '⚡', text: 'Wer hält die wichtigsten Patente für Festkörperakkus und wie weit ist die Serienreife?' },
  { icon: '⚡', text: 'Wie funktioniert Retrieval-Augmented Generation (RAG) im Detail und wann nutzt man Fine-Tuning?' },
  { icon: '⚡', text: 'Fasse die wichtigsten regulatorischen Neuerungen des EU AI Acts zusammen' },
];

export default function ChatApp({ configured, searchConfigured, provider, showCosts }: Props) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [excerpts, setExcerpts] = useState<ExcerptRecord[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [activity, setActivity] = useState<ActivityState>(initialActivityState);
  const [runId, setRunId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<Mode>('auto');
  const [researchOptions, setResearchOptions] = useState<ResearchOptions>({});
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [digitalIdOpen, setDigitalIdOpen] = useState(true);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [lastRequest, setLastRequest] = useState('');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [model, setModel] = useState<string>('');
  const [vectorModalOpen, setVectorModalOpen] = useState(false);
  const [researchControlsOpen, setResearchControlsOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const closeStream = useRef<(() => void) | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeModeConfig = getResearchMode(mode);

  const intentTab = mode === 'chat' ? 'say' : mode === 'auto' ? 'auto' : 'search';
  const currentPrompts =
    intentTab === 'say'
      ? SAY_EXAMPLES
      : intentTab === 'auto'
      ? AUTO_EXAMPLES
      : SEARCH_EXAMPLES;

  const refreshConversations = useCallback(async () => {
    try {
      const { conversations: list } = await api.listConversations();
      setConversations(list);
    } catch {
      /* Liste bleibt unverändert */
    }
  }, []);

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  useEffect(() => {
    textareaRef.current?.focus();
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setDigitalIdOpen(false);
    }
  }, []);

  // Recherche-Modus und Optionen aus LocalStorage wiederherstellen
  useEffect(() => {
    try {
      const storedMode = window.localStorage.getItem('insight-agent:mode') as Mode | null;
      if (
        storedMode &&
        [
          'auto',
          'chat',
          'research',
          'deep_research',
          'web_lookup',
          'comparison',
          'data_analysis',
          'report_generation',
        ].includes(storedMode)
      ) {
        setMode(storedMode);
      }
      const storedOpts = window.localStorage.getItem('insight-agent:research-options');
      if (storedOpts) {
        setResearchOptions(JSON.parse(storedOpts) as ResearchOptions);
      }
    } catch {
      /* optional */
    }
  }, []);

  const chooseMode = useCallback((newMode: Mode) => {
    setMode(newMode);
    try {
      window.localStorage.setItem('insight-agent:mode', newMode);
    } catch {
      /* optional */
    }
    const modeConfig = getResearchMode(newMode);
    if (modeConfig.defaultOptions) {
      setResearchOptions((prev) => ({ ...prev, ...modeConfig.defaultOptions }));
    }
  }, []);

  const updateResearchOptions = useCallback((opts: ResearchOptions) => {
    setResearchOptions(opts);
    try {
      window.localStorage.setItem('insight-agent:research-options', JSON.stringify(opts));
    } catch {
      /* optional */
    }
  }, []);

  // Modellkatalog des aktiven Anbieters laden; letzte Wahl aus dem Browser wiederherstellen.
  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    void (async () => {
      try {
        const catalog = await api.listModels();
        if (cancelled) return;
        setModels(catalog.models);
        let stored: string | null = null;
        try {
          stored = window.localStorage.getItem('insight-agent:model');
        } catch {
          stored = null;
        }
        const available = new Set(catalog.models.map((m) => m.id));
        setModel(stored && available.has(stored) ? stored : (catalog.currentMain ?? ''));
      } catch {
        /* Katalog nicht verfügbar — Standardmodell bleibt aktiv */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configured]);

  const chooseModel = useCallback((value: string) => {
    setModel(value);
    try {
      window.localStorage.setItem('insight-agent:model', value);
    } catch {
      /* Speichern ist optional */
    }
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const onScroll = () => {
      stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    };
    element.addEventListener('scroll', onScroll);
    return () => element.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (stickToBottom.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activity.streamed, activity.lines.length]);

  useEffect(() => () => closeStream.current?.(), []);

  const loadRunState = useCallback(async (id: string) => {
    try {
      const detail = await api.getRun(id);
      setSources(detail.sources);
      setExcerpts(detail.excerpts);
      setConflicts(detail.conflicts);
      if (detail.run.error) {
        setError(detail.run.error.userMessage);
      }
    } catch {
      /* Run-Detail nicht ladbar */
    }
  }, []);

  const attachStream = useCallback(
    (id: string, lastEventId: number) => {
      closeStream.current?.();
      setRunning(true);
      closeStream.current = openRunStream(id, lastEventId, {
        onEvent: (event) => {
          setActivity((current) => activityReducer(current, event));
          if (event.type === 'message.delta') {
            const payload = event.payload as { messageId: string; delta: string };
            setMessages((current) => {
              const existing = current.find((m) => m.id === payload.messageId);
              if (!existing) {
                return [
                  ...current,
                  {
                    id: payload.messageId,
                    conversationId: activeId ?? '',
                    role: 'assistant',
                    content: payload.delta,
                    status: 'streaming',
                    runId: id,
                    createdAt: event.ts,
                    updatedAt: event.ts,
                    citations: [],
                  },
                ];
              }
              return current.map((m) =>
                m.id === payload.messageId ? { ...m, content: m.content + payload.delta } : m,
              );
            });
          } else if (event.type === 'run.completed') {
            const payload = event.payload as { messageId: string };
            setMessages((current) =>
              current.map((m) => (m.id === payload.messageId ? { ...m, status: 'complete' } : m)),
            );
            void api.getRun(id).then((detail) => {
              setSources(detail.sources);
              setExcerpts(detail.excerpts);
              setConflicts(detail.conflicts);
            }).catch(() => undefined);
          } else if (event.type === 'run.failed') {
            const payload = event.payload as unknown as { messageId?: string; error: { userMessage: string } };
            setError(payload.error.userMessage);
            if (payload.messageId) {
              setMessages((current) =>
                current.map((m) => (m.id === payload.messageId ? { ...m, status: 'failed' } : m)),
              );
            }
          }
        },
        onDone: () => {
          setRunning(false);
          void loadRunState(id);
          void refreshConversations();
        },
        onError: (message) => {
          setRunning(false);
          setError(message);
        },
      });
    },
    [activeId, loadRunState, refreshConversations],
  );

  const selectConversation = useCallback(
    async (id: string) => {
      closeStream.current?.();
      setRunning(false);
      setActiveId(id);
      setError(null);
      setActivity(initialActivityState);
      setSidebarOpen(false);
      try {
        const detail = await api.getConversation(id);
        setMessages(detail.messages);
        setSources(detail.sources);
        setExcerpts([]);
        setConflicts([]);
        const last = detail.lastRun;
        if (last && !['completed', 'failed', 'cancelled'].includes(last.status)) {
          setRunId(last.id);
          attachStream(last.id, 0);
        } else if (last) {
          setRunId(last.id);
          void loadRunState(last.id);
        }
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [attachStream, loadRunState],
  );

  const startNew = useCallback(() => {
    closeStream.current?.();
    setRunning(false);
    setActiveId(null);
    setMessages([]);
    setSources([]);
    setExcerpts([]);
    setConflicts([]);
    setActivity(initialActivityState);
    setRunId(null);
    setError(null);
    setSidebarOpen(false);
    textareaRef.current?.focus();
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length === 0 || running) return;
      setError(null);
      setInput('');
      setLastRequest(trimmed);
      setActivity(initialActivityState);
      stickToBottom.current = true;

      const optimistic: MessageView = {
        id: `local-${Date.now()}`,
        conversationId: activeId ?? '',
        role: 'user',
        content: trimmed,
        status: 'complete',
        runId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        citations: [],
        researchOptions: Object.keys(researchOptions).length > 0 ? { ...researchOptions } : undefined,
      };
      setMessages((current) => [...current, optimistic]);

      try {
        const created = await api.createRun(
          trimmed,
          activeId,
          mode,
          model || undefined,
          Object.keys(researchOptions).length > 0 ? researchOptions : undefined,
        );
        setActiveId(created.conversationId);
        setRunId(created.runId);
        attachStream(created.runId, 0);
        void refreshConversations();
      } catch (err) {
        setError((err as Error).message);
        setMessages((current) => current.filter((m) => m.id !== optimistic.id));
        setInput(trimmed);
      }
    },
    [activeId, attachStream, mode, model, refreshConversations, researchOptions, running],
  );

  const stop = useCallback(async () => {
    if (!runId) return;
    try {
      await api.cancelRun(runId);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [runId]);

  const removeConversation = useCallback(
    async (id: string) => {
      try {
        await api.deleteConversation(id);
        if (id === activeId) startNew();
        void refreshConversations();
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [activeId, refreshConversations, startNew],
  );

  const renameConversation = useCallback(
    async (id: string, newTitle: string) => {
      try {
        setConversations((current) =>
          current.map((c) => (c.id === id ? { ...c, title: newTitle } : c)),
        );
        await api.renameConversation(id, newTitle);
        void refreshConversations();
      } catch (err) {
        setError((err as Error).message);
        void refreshConversations();
      }
    },
    [refreshConversations],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && running) void stop();
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        startNew();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running, startNew, stop]);

  const focusSource = useCallback((marker: number) => {
    setHighlighted(marker);
    setSourcesOpen(true);
    setTimeout(() => {
      document.getElementById(`source-${marker}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
    setTimeout(() => setHighlighted(null), 2500);
  }, []);

  const excerptsBySource = new Map<string, { id: string; text: string }[]>();
  for (const excerpt of excerpts) {
    const list = excerptsBySource.get(excerpt.sourceId) ?? [];
    list.push({ id: excerpt.id, text: excerpt.text });
    excerptsBySource.set(excerpt.sourceId, list);
  }
  const conflictIndexes = new Set(conflicts.flatMap((c) => c.entries.map((e) => e.index)));
  const knownMarkers = new Set(sources.map((s) => s.indexNum));

  const hasActiveFilters = Boolean(
    researchOptions.depth ||
    (researchOptions.timeframe && researchOptions.timeframe !== 'all') ||
    (researchOptions.outputFormat && researchOptions.outputFormat !== 'standard')
  );

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Seitenleiste mit allen Recherche-Modi & Chats */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-80 shadow-[8px_0_32px_-6px_rgba(0,0,0,0.22)] transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={(id) => void selectConversation(id)}
          onNew={startNew}
          onDelete={(id) => void removeConversation(id)}
          onRename={(id, newTitle) => void renameConversation(id, newTitle)}
          onClose={() => setSidebarOpen(false)}
          mode={mode}
          onModeChange={chooseMode}
          researchOptions={researchOptions}
          onOptionsChange={updateResearchOptions}
        />
      </div>
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Seitenleiste schließen"
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="relative flex items-center gap-3 border-b border-border/80 bg-surface/90 px-4 py-3 backdrop-blur-xl shadow-[0_4px_24px_-4px_rgba(0,0,0,0.12)] z-10">
          <div className="animated-line absolute bottom-0 left-0 right-0 h-[2px] opacity-75" />
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-xl border border-border/80 px-2.5 py-1.5 text-sm text-muted hover:border-accent hover:text-fg shadow-xs lg:hidden"
            aria-label="Unterhaltungen öffnen"
          >
            ☰
          </button>
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-accent to-teal-400 text-white shadow-[0_0_16px_rgb(var(--accent)/0.5)] ring-1 ring-white/20">
              <span className="text-xs font-black tracking-wider">IA</span>
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-surface shadow-[0_0_8px_#34d399]" />
            </div>
            <h1 className="font-display truncate text-base font-bold tracking-tight text-fg">Insight Agent</h1>
          </div>
          {configured && (
            <span className="hidden rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent shadow-[0_0_10px_rgb(var(--accent)/0.2)] sm:inline">
              {PROVIDER_LABEL[provider] ?? provider}
            </span>
          )}

          {/* Quick Mode Pill im Header */}
          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-surface px-2.5 py-1.5 text-xs font-semibold text-fg shadow-xs transition-all hover:border-accent hover:shadow-[0_0_12px_rgb(var(--accent)/0.2)]"
            title="Recherche-Modus in der Seitenleiste anpassen"
          >
            <span>{activeModeConfig.icon}</span>
            <span className="hidden sm:inline font-medium">{activeModeConfig.shortName}</span>
          </button>

          <div className="ml-auto flex items-center gap-2">
            {configured && models.length > 0 && (
              <>
                <label className="sr-only" htmlFor="model">Modell</label>
                <select
                  id="model"
                  value={model}
                  onChange={(event) => chooseModel(event.target.value)}
                  className="max-w-[13rem] truncate rounded-xl border border-border/80 bg-surface px-3 py-1.5 text-xs shadow-xs hover:border-accent hover:shadow-[0_0_12px_rgb(var(--accent)/0.2)] focus:outline-none focus:ring-1 focus:ring-accent"
                  title="Modell für neue Anfragen"
                >
                  <optgroup label="Empfohlen">
                    {models.filter((m) => m.recommended).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.id}{m.note ? ` — ${m.note}` : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={`Alle Modelle (${models.filter((m) => !m.recommended).length})`}>
                    {models.filter((m) => !m.recommended).map((m) => (
                      <option key={m.id} value={m.id}>{m.id}</option>
                    ))}
                  </optgroup>
                </select>
              </>
            )}
            <button
              type="button"
              onClick={() => setVectorModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-surface px-3 py-1.5 text-xs font-semibold text-fg shadow-xs hover:border-accent hover:shadow-[0_0_14px_rgb(var(--accent)/0.25)] transition-all"
              title="Vektordatenbank & Semantische Suche über alle Daten und Prompts"
            >
              <span>🧠</span>
              <span className="hidden sm:inline">Vector DB</span>
            </button>

            <button
              type="button"
              onClick={() => setDigitalIdOpen((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all shadow-xs ${
                digitalIdOpen
                  ? 'border-accent bg-accent/15 text-accent shadow-[0_0_12px_rgb(var(--accent)/0.25)]'
                  : 'border-border/80 bg-surface text-muted hover:border-accent hover:text-fg'
              }`}
              title="Digital ID & Persona-Gedächtnis öffnen"
            >
              <span>🪪</span>
              <span className="hidden sm:inline">Digital ID</span>
            </button>

            <button
              type="button"
              onClick={() => setSourcesOpen((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all shadow-xs ${
                sourcesOpen
                  ? 'border-accent bg-accent/15 text-accent shadow-[0_0_12px_rgb(var(--accent)/0.25)]'
                  : 'border-border/80 bg-surface text-muted hover:border-accent hover:text-fg'
              }`}
              title="Quellen & Recherchebelege anzeigen"
            >
              <span>📚</span>
              <span className="hidden sm:inline">Quellen</span>
              {sources.length > 0 && (
                <span className="rounded-full bg-accent/20 px-1.5 py-0.2 text-[10px] text-accent font-bold">
                  {sources.filter((s) => s.status === 'fetched').length}
                </span>
              )}
            </button>
          </div>
        </header>

        {!configured && (
          <div className="border-b border-border/80 bg-surface/90 px-4 py-2.5 text-sm backdrop-blur-md">
            <p className="font-medium text-fg">Modell verbinden</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              <code className="rounded bg-bg px-1 py-0.5">npm run set-key</code> für OpenAI/NVIDIA, oder{' '}
              <code className="rounded bg-bg px-1 py-0.5">LLM_PROVIDER=hermes</code> in{' '}
              <code className="rounded bg-bg px-1 py-0.5">.env.local</code> — keine simulierten Antworten.
            </p>
          </div>
        )}
        {configured && !searchConfigured && (
          <div className="border-b border-border bg-surface/80 px-4 py-2 text-xs text-muted">
            Websuche nicht konfiguriert — Recherche braucht <code>BRAVE_API_KEY</code>,{' '}
            <code>TAVILY_API_KEY</code> oder Hermes-Suche.
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col justify-center px-4 sm:px-6 py-8 min-h-full space-y-7">
            {messages.length === 0 && (
              <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-surface/50 p-6 sm:p-7 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] backdrop-blur-md">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 -z-10 h-64 w-[85%] rounded-full opacity-40 blur-3xl animate-glow-pulse"
                  style={{
                    background:
                      'radial-gradient(circle, rgb(var(--accent) / 0.35) 0%, rgb(var(--glow) / 0.15) 50%, transparent 70%)',
                  }}
                />

                {/* Header-Zeile: Badge + Digital ID Schnell-Status */}
                <div className="hero-rise mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent shadow-[0_0_12px_rgb(var(--accent)/0.2)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse shadow-[0_0_6px_rgb(var(--accent))]" />
                    <span>Insight Agent</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDigitalIdOpen((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-surface/80 px-2.5 py-0.5 text-[11px] font-medium text-muted hover:border-accent hover:text-fg transition-all"
                    title="Digital ID & Persona-Panel in der rechten Seitenleiste öffnen"
                  >
                    <span>🪪</span>
                    <span>Digital ID {digitalIdOpen ? 'aktiv' : 'geschlossen'}</span>
                  </button>
                </div>

                {/* Leitfrage laut Benutzeranforderung */}
                <h1 className="hero-rise font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl leading-tight">
                  Was möchtest du heute suchen oder sagen?
                </h1>
                <p className="hero-rise hero-rise-delay-1 mt-1 text-xs text-muted leading-relaxed max-w-xl">
                  Wähle zwischen gezielter Webrecherche, dialogischem Denken oder autonomer Erkennung.
                </p>

                {/* Schlanke Tabs: Suchen | Sagen | Auto */}
                <div className="hero-rise hero-rise-delay-2 mt-4 flex items-center gap-1.5 rounded-2xl border border-border/80 bg-surface/80 p-1 w-fit shadow-xs">
                  <button
                    type="button"
                    onClick={() => chooseMode(mode === 'chat' || mode === 'auto' ? 'research' : mode)}
                    className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                      intentTab === 'search'
                        ? 'bg-accent text-white shadow-[0_0_12px_rgb(var(--accent)/0.35)]'
                        : 'text-muted hover:text-fg hover:bg-surface'
                    }`}
                  >
                    <span>🔍</span>
                    <span>Suchen</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => chooseMode('chat')}
                    className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                      intentTab === 'say'
                        ? 'bg-accent text-white shadow-[0_0_12px_rgb(var(--accent)/0.35)]'
                        : 'text-muted hover:text-fg hover:bg-surface'
                    }`}
                  >
                    <span>💬</span>
                    <span>Sagen</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => chooseMode('auto')}
                    className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                      intentTab === 'auto'
                        ? 'bg-accent text-white shadow-[0_0_12px_rgb(var(--accent)/0.35)]'
                        : 'text-muted hover:text-fg hover:bg-surface'
                    }`}
                  >
                    <span>⚡</span>
                    <span>Auto</span>
                  </button>
                </div>

                {/* Sub-Modus-Auswahl nur bei Suche, kompakt in 1 Zeile */}
                {intentTab === 'search' && (
                  <div className="hero-rise hero-rise-delay-2 mt-3 flex flex-wrap items-center gap-1 text-[11px]">
                    <span className="text-muted mr-1 font-medium">Modus:</span>
                    {RESEARCH_MODES.filter((m) => m.id !== 'chat' && m.id !== 'auto').map((m) => {
                      const isSelected = mode === m.id || (mode === 'research' && m.id === 'deep_research');
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => chooseMode(m.id)}
                          className={`rounded-lg px-2 py-0.5 font-medium transition-all ${
                            isSelected
                              ? 'bg-accent/20 text-accent font-semibold ring-1 ring-accent/40 shadow-[0_0_8px_rgb(var(--accent)/0.2)]'
                              : 'text-muted hover:text-fg hover:bg-surface'
                          }`}
                        >
                          <span>{m.icon}</span>{' '}
                          <span>{m.shortName}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Schlanke Prompt-Chips */}
                <div className="hero-rise hero-rise-delay-3 mt-4 space-y-1.5">
                  {currentPrompts.map((item) => (
                    <button
                      key={item.text}
                      type="button"
                      onClick={() => {
                        setInput(item.text);
                        setTimeout(() => {
                          if (textareaRef.current) {
                            textareaRef.current.focus();
                            textareaRef.current.setSelectionRange(item.text.length, item.text.length);
                          }
                        }, 0);
                      }}
                      className="group flex w-full items-center justify-between rounded-xl border border-border/60 bg-surface/70 px-3.5 py-2 text-left text-xs text-fg transition-all hover:border-accent hover:bg-surface hover:shadow-xs"
                    >
                      <span className="truncate pr-2 group-hover:text-accent transition-colors">
                        <span className="mr-2 opacity-80">{item.icon}</span>
                        {item.text}
                      </span>
                      <span className="text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all text-[11px] shrink-0 font-bold">
                        →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => {
              const isLastAssistant = message.role === 'assistant' && index === messages.length - 1;
              return (
                <div key={message.id} className="mb-5">
                  {message.role === 'user' ? (
                    <div className="flex justify-end">
                      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl border border-border/70 bg-surface/95 px-4 sm:px-5 py-3 text-sm text-fg shadow-[0_4px_16px_-2px_rgba(0,0,0,0.1)] leading-relaxed">
                        <div>{message.content}</div>
                        {message.researchOptions && (
                          <div className="mt-2 pt-2 border-t border-border/40 flex flex-wrap items-center gap-1.5 text-[10px]">
                            {message.researchOptions.depth && message.researchOptions.depth !== 'standard' && (
                              <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-accent font-medium">
                                ⚡ Tiefe: {message.researchOptions.depth}
                              </span>
                            )}
                            {message.researchOptions.timeframe && message.researchOptions.timeframe !== 'all' && (
                              <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-amber-700 dark:text-amber-300 font-medium">
                                ⏳ Zeitraum: {message.researchOptions.timeframe}
                              </span>
                            )}
                            {message.researchOptions.aspects && (
                              <span
                                className="rounded-md bg-teal-500/15 px-1.5 py-0.5 text-teal-700 dark:text-teal-300 font-medium max-w-xs truncate"
                                title={message.researchOptions.aspects}
                              >
                                🎯 Fokus: {message.researchOptions.aspects}
                              </span>
                            )}
                            {message.researchOptions.focusDomains && message.researchOptions.focusDomains.length > 0 && (
                              <span className="rounded-md bg-blue-500/15 px-1.5 py-0.5 text-blue-700 dark:text-blue-300 font-medium">
                                🌐 Quellen: {message.researchOptions.focusDomains.join(', ')}
                              </span>
                            )}
                            {message.researchOptions.excludeDomains && message.researchOptions.excludeDomains.length > 0 && (
                              <span className="rounded-md bg-red-500/15 px-1.5 py-0.5 text-red-700 dark:text-red-300 font-medium">
                                🚫 Ausgeschlossen: {message.researchOptions.excludeDomains.join(', ')}
                              </span>
                            )}
                            {message.researchOptions.outputFormat && message.researchOptions.outputFormat !== 'standard' && (
                              <span className="rounded-md bg-purple-500/15 px-1.5 py-0.5 text-purple-700 dark:text-purple-300 font-medium">
                                📑 Format: {message.researchOptions.outputFormat}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      {isLastAssistant && activity.visible && (
                        <ActivityCard state={activity} showCosts={showCosts} />
                      )}
                      <Markdown
                        content={message.content}
                        knownMarkers={knownMarkers}
                        onCitationClick={focusSource}
                      />
                      {message.status === 'cancelled' && (
                        <p className="mt-2 text-xs font-medium text-amber-400">Abgebrochen.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {running && activity.visible && !messages.some((m) => m.role === 'assistant' && m.status === 'streaming') && (
              <ActivityCard state={activity} showCosts={showCosts} />
            )}

            {error && (
              <div className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm shadow-[0_0_18px_rgba(239,68,68,0.15)]">
                <p className="font-semibold text-red-300">Fehler aufgetreten</p>
                <p className="mt-1 text-xs text-red-200/90 leading-relaxed">{error}</p>
                {lastRequest && !running && (
                  <button
                    type="button"
                    onClick={() => void send(lastRequest)}
                    className="mt-2.5 rounded-xl border border-red-500/40 bg-surface px-3 py-1.5 text-xs font-semibold text-fg shadow-xs hover:border-accent hover:shadow-[0_0_12px_rgb(var(--accent)/0.2)]"
                  >
                    Erneut versuchen
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Eingabebereich mit ResearchControls */}
        <div className="relative border-t border-border/80 bg-surface/85 px-4 sm:px-6 py-3.5 backdrop-blur-xl shadow-[0_-8px_32px_-6px_rgba(0,0,0,0.16)]">
          <div className="animated-line absolute top-0 left-0 right-0 h-[2px]" />
          
          <div className="mx-auto mb-1.5 w-full max-w-3xl">
            <ResearchControls
              mode={mode}
              onModeChange={chooseMode}
              options={researchOptions}
              onOptionsChange={updateResearchOptions}
              isOpen={researchControlsOpen}
              onToggleOpen={() => setResearchControlsOpen((v) => !v)}
              disabled={running}
            />
          </div>

          <div className="mx-auto flex w-full max-w-3xl items-end gap-3">
            <div className="relative flex-1 rounded-2xl border border-border/85 bg-surface/95 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.1),0_0_16px_-3px_rgb(var(--accent)/0.12)] transition-all duration-200 focus-within:border-accent focus-within:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.2),0_0_24px_rgb(var(--accent)/0.35)]">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value.slice(0, 20000))}
                onKeyDown={(event) => {
                  const isCmdOrCtrlEnter = event.key === 'Enter' && (event.metaKey || event.ctrlKey);
                  const isPlainEnter = event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey;
                  if (isCmdOrCtrlEnter || isPlainEnter) {
                    event.preventDefault();
                    void send(input);
                  }
                }}
                rows={1}
                placeholder={
                  mode === 'deep_research' || mode === 'research'
                    ? 'Rechercheauftrag eingeben (mehrstufige Suche & belegte Citations) …'
                    : mode === 'web_lookup'
                    ? 'Tagesaktuelle Fakten, News oder Kursdaten abfragen …'
                    : mode === 'comparison'
                    ? 'Welche Produkte, Konzepte oder Optionen möchtest du vergleichen? …'
                    : mode === 'data_analysis'
                    ? 'Statistiken, KPIs oder quantitative Datenpunkte analysieren …'
                    : mode === 'report_generation'
                    ? 'Thema für einen ausführlichen, gegliederten Recherchebericht eingeben …'
                    : mode === 'chat'
                    ? 'Direkte Frage stellen oder Brainstorming ohne Websuche starten …'
                    : 'Frage stellen oder Rechercheauftrag geben (Auto-Modus aktiv) …'
                }
                aria-label="Nachricht"
                className="max-h-48 min-h-[48px] w-full resize-y rounded-2xl bg-transparent px-4 py-3 text-sm text-fg outline-none placeholder:text-muted/70 leading-relaxed"
              />
            </div>
            {running ? (
              <button
                type="button"
                onClick={() => void stop()}
                className="h-12 shrink-0 rounded-2xl border border-red-500/40 bg-surface/90 px-5 text-sm font-semibold text-red-300 shadow-sm transition hover:border-red-500 hover:bg-surface hover:text-red-200"
              >
                Stopp
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void send(input)}
                disabled={input.trim().length === 0 || !configured}
                className="h-12 shrink-0 rounded-2xl bg-accent px-6 text-sm font-bold text-white shadow-[0_10px_28px_rgb(var(--accent)/0.38)] transition enabled:hover:brightness-110 enabled:hover:shadow-[0_12px_32px_rgb(var(--accent)/0.5)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Senden
              </button>
            )}
          </div>
          <p className="mx-auto mt-2 w-full max-w-3xl text-[11px] text-muted">
            Enter oder ⌘+Enter senden · Shift+Enter Zeilenumbruch · Esc stoppt · {input.length}/20000
          </p>
        </div>
      </main>

      {/* 2 Seitenleisten rechts: 1. Digital ID & Persona Profile, 2. Quellen & Recherche */}
      {(digitalIdOpen || sourcesOpen) && (
        <>
          <button
            type="button"
            aria-label="Rechte Seitenleiste schließen"
            className="fixed inset-0 z-20 bg-black/40 backdrop-blur-xs lg:hidden"
            onClick={() => {
              setDigitalIdOpen(false);
              setSourcesOpen(false);
            }}
          />
          <div className="flex shrink-0">
            {digitalIdOpen && (
              <aside
                aria-label="Digital ID & Persona-Profil"
                className={`panel-in fixed inset-y-0 right-0 z-30 w-72 sm:w-80 border-l border-border/80 bg-surface/95 backdrop-blur-xl shadow-[-8px_0_32px_-6px_rgba(0,0,0,0.18)] transition-transform lg:static lg:translate-x-0 ${
                  sourcesOpen ? 'xl:border-r xl:border-border/80' : ''
                }`}
              >
                <DigitalIdPanel
                  userId="usr_local"
                  conversationCount={conversations.length}
                  sourcesCount={sources.length}
                  onClose={() => setDigitalIdOpen(false)}
                />
              </aside>
            )}

            {sourcesOpen && (
              <aside
                aria-label="Quellen & Recherchebelege"
                className="panel-in fixed inset-y-0 right-0 z-30 w-72 sm:w-80 border-l border-border/80 bg-surface/95 backdrop-blur-xl shadow-[-8px_0_32px_-6px_rgba(0,0,0,0.18)] transition-transform lg:static lg:translate-x-0"
              >
                <SourcesPanel
                  sources={sources}
                  highlighted={highlighted}
                  conflictIndexes={conflictIndexes}
                  excerptsBySource={excerptsBySource}
                  onClose={() => setSourcesOpen(false)}
                />
              </aside>
            )}
          </div>
        </>
      )}

      {/* Vector DB Explorer Modal */}
      <VectorSearchModal
        isOpen={vectorModalOpen}
        onClose={() => setVectorModalOpen(false)}
      />
    </div>
  );
}

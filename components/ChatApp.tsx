'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, openRunStream } from '@/lib/client/api';
import type { ConversationSummary, Mode, MessageView } from '@/lib/client/types';
import type { Conflict, ExcerptRecord, SourceRecord } from '@/lib/contracts/domain';
import { activityReducer, initialActivityState, type ActivityState } from '@/lib/client/activity-reducer';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ActivityCard } from '@/components/activity/ActivityCard';
import { SourcesPanel } from '@/components/sources/SourcesPanel';
import { Markdown } from '@/components/chat/Markdown';

const EXAMPLES = [
  'Recherchiere aktuelle Statistiken über den Fußballspieler Jamal Musiala.',
  'Vergleiche den Umsatz der wertvollsten europäischen Fußballvereine und erstelle eine Tabelle.',
  'Was ist ein Vektor-Embedding?',
];

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
  nvidia: 'NVIDIA NIM',
  compatible: 'OpenAI-kompatibel',
  hermes: 'Hermes',
  none: 'nicht konfiguriert',
};

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
  // Der Agent entscheidet selbst zwischen Chat und Recherche — keine manuelle Auswahl.
  const mode: Mode = 'auto';
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [lastRequest, setLastRequest] = useState('');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [model, setModel] = useState<string>('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const closeStream = useRef<(() => void) | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      if (detail.message) {
        const finalMessage = detail.message;
        setMessages((current) =>
          current.map((m) =>
            m.id === finalMessage.id ? { ...finalMessage, citations: detail.citations } : m,
          ),
        );
      }
      if (detail.run.error) setError(detail.run.error.userMessage);
    } catch {
      /* Endzustand nicht abrufbar — gestreamter Text bleibt sichtbar */
    }
  }, []);

  const attachStream = useCallback(
    (id: string, afterSeq: number) => {
      closeStream.current?.();
      setRunning(true);
      closeStream.current = openRunStream(id, afterSeq, {
        onEvent: (event) => {
          setActivity((state) => activityReducer(state, event));
          if (event.type === 'message.delta') {
            const payload = event.payload as { messageId: string; delta: string };
            setMessages((current) => {
              const index = current.findIndex((m) => m.id === payload.messageId);
              if (index === -1) {
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
              const next = [...current];
              const existing = next[index] as MessageView;
              next[index] = { ...existing, content: existing.content + payload.delta };
              return next;
            });
          }
          if (event.type === 'source.opened' || event.type === 'source.extracted') {
            void api.getRun(id).then((detail) => {
              setSources(detail.sources);
              setExcerpts(detail.excerpts);
            }).catch(() => undefined);
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
      };
      setMessages((current) => [...current, optimistic]);

      try {
        const created = await api.createRun(trimmed, activeId, mode, model || undefined);
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
    [activeId, attachStream, mode, model, refreshConversations, running],
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
    setPanelOpen(true);
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

  return (
    <div className="flex h-dvh overflow-hidden">
      <div
        className={`fixed inset-y-0 left-0 z-30 w-72 transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={(id) => void selectConversation(id)}
          onNew={startNew}
          onDelete={(id) => void removeConversation(id)}
          onClose={() => setSidebarOpen(false)}
        />
      </div>
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Seitenleiste schließen"
          className="fixed inset-0 z-20 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border/80 bg-surface/70 px-3 py-2.5 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg border border-border px-2.5 py-1.5 text-sm lg:hidden"
            aria-label="Unterhaltungen öffnen"
          >
            ☰
          </button>
          <h1 className="font-display truncate text-base font-semibold tracking-tight">Insight Agent</h1>
          {configured && (
            <span className="hidden rounded-full border border-border px-2 py-0.5 text-[11px] text-muted sm:inline">
              {PROVIDER_LABEL[provider] ?? provider}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {configured && models.length > 0 && (
              <>
                <label className="sr-only" htmlFor="model">Modell</label>
                <select
                  id="model"
                  value={model}
                  onChange={(event) => chooseModel(event.target.value)}
                  className="max-w-[13rem] truncate rounded-lg border border-border bg-surface px-2 py-1.5 text-xs"
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
            {sources.length > 0 && (
              <button
                type="button"
                onClick={() => setPanelOpen((v) => !v)}
                className="rounded-lg border border-border px-2.5 py-1.5 text-xs xl:hidden"
              >
                Quellen ({sources.filter((s) => s.status === 'fetched').length})
              </button>
            )}
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
          <div className="mx-auto flex w-full max-w-3xl flex-col justify-center px-4 py-6 min-h-full">
            {messages.length === 0 && (
              <div className="relative overflow-hidden rounded-3xl px-1 pb-2 pt-4 sm:pt-8">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 -z-10 rounded-3xl opacity-90"
                  style={{
                    background:
                      'radial-gradient(80% 70% at 20% 10%, rgb(var(--accent) / 0.14), transparent 60%), radial-gradient(70% 60% at 90% 30%, rgb(var(--glow) / 0.18), transparent 55%)',
                  }}
                />
                <p className="hero-rise font-display text-4xl font-extrabold tracking-tight text-fg sm:text-5xl md:text-[3.25rem]">
                  Insight Agent
                </p>
                <h2 className="hero-rise hero-rise-delay-1 mt-3 max-w-xl text-lg font-semibold tracking-tight text-fg sm:text-xl">
                  Recherche, die jede Aussage belegt.
                </h2>
                <p className="hero-rise hero-rise-delay-2 mt-2 max-w-lg text-sm text-muted">
                  Frage stellen oder Rechercheauftrag geben — Planung, Quellen, Citations.
                </p>
                <ul className="hero-rise hero-rise-delay-3 mt-6 grid gap-2 sm:grid-cols-1">
                  {EXAMPLES.map((example) => (
                    <li key={example}>
                      <button
                        type="button"
                        onClick={() => {
                          setInput(example);
                          requestAnimationFrame(() => textareaRef.current?.focus());
                        }}
                        className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-left text-sm text-fg shadow-[0_1px_0_rgb(var(--border)/0.35)] transition hover:border-accent hover:shadow-[0_0_0_1px_rgb(var(--accent)/0.35)]"
                      >
                        {example}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {messages.map((message, index) => {
              const isLastAssistant = message.role === 'assistant' && index === messages.length - 1;
              return (
                <div key={message.id} className="mb-5">
                  {message.role === 'user' ? (
                    <div className="flex justify-end">
                      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-surface px-4 py-2.5 text-sm">
                        {message.content}
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
                        <p className="mt-2 text-xs text-muted">Abgebrochen.</p>
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
              <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm">
                <p>{error}</p>
                {lastRequest && !running && (
                  <button
                    type="button"
                    onClick={() => void send(lastRequest)}
                    className="mt-2 rounded border border-border px-2.5 py-1 text-xs hover:bg-surface"
                  >
                    Erneut versuchen
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border/80 bg-bg/80 px-4 py-3 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-3xl items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value.slice(0, 20000))}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void send(input);
                }
              }}
              rows={1}
              placeholder="Frage stellen oder Rechercheauftrag geben …"
              aria-label="Nachricht"
              className="max-h-48 min-h-[44px] flex-1 resize-y rounded-2xl border border-border bg-surface/95 px-3.5 py-2.5 text-sm outline-none transition focus:border-accent"
            />
            {running ? (
              <button
                type="button"
                onClick={() => void stop()}
                className="h-11 shrink-0 rounded-2xl border border-border px-4 text-sm font-medium hover:bg-surface"
              >
                Stopp
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void send(input)}
                disabled={input.trim().length === 0 || !configured}
                className="h-11 shrink-0 rounded-2xl bg-accent px-5 text-sm font-semibold text-white shadow-[0_10px_28px_rgb(var(--accent)/0.35)] transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Senden
              </button>
            )}
          </div>
          <p className="mx-auto mt-1.5 w-full max-w-3xl text-[11px] text-muted">
            Enter senden · Shift+Enter Zeilenumbruch · Esc stoppt · {input.length}/20000
          </p>
        </div>
      </main>

      {sources.length > 0 && (
        <aside
          className={`panel-in fixed inset-y-0 right-0 z-30 w-80 border-l border-border bg-surface/95 backdrop-blur-md transition-transform xl:static xl:translate-x-0 ${
            panelOpen ? 'translate-x-0' : 'translate-x-full xl:translate-x-0'
          }`}
        >
          <SourcesPanel
            sources={sources}
            highlighted={highlighted}
            conflictIndexes={conflictIndexes}
            excerptsBySource={excerptsBySource}
          />
        </aside>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';

interface Props {
  userId?: string;
  conversationCount?: number;
  sourcesCount?: number;
  onClose?: () => void;
}

const DEFAULT_FACTS = [
  'Bevorzugt tabellarische Vergleiche und strukturierte Übersichten.',
  'Quellenkritisch: Primärquellen und verifizierte Zahlen priorisieren.',
  'Sprache: Deutsch (präzise, sachlich, ohne werbliche Floskeln).',
  'Recherche-Budget strikt einhalten und Widersprüche transparent machen.',
];

const DEFAULT_TOPICS = [
  { name: 'KI & Vektor-Suche', count: 12 },
  { name: 'Sport & Leistungsdaten', count: 8 },
  { name: 'Wirtschaft & Unternehmenszahlen', count: 6 },
  { name: 'Softwarearchitektur', count: 5 },
];

export function DigitalIdPanel({
  userId = 'usr_local',
  conversationCount = 0,
  sourcesCount = 0,
  onClose,
}: Props) {
  const [activeTab, setActiveTab] = useState<'memory' | 'topics' | 'settings'>('memory');
  const [displayName, setDisplayName] = useState('Lokaler Nutzer');
  const [isEditingName, setIsEditingName] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [facts, setFacts] = useState<string[]>(DEFAULT_FACTS);
  const [newFact, setNewFact] = useState('');
  const [isAddingFact, setIsAddingFact] = useState(false);
  const [topics, setTopics] = useState(DEFAULT_TOPICS);
  const [newTopic, setNewTopic] = useState('');

  useEffect(() => {
    try {
      const savedName = localStorage.getItem('insight-agent:user-name');
      if (savedName) setDisplayName(savedName);
      const savedFacts = localStorage.getItem('insight-agent:user-facts');
      if (savedFacts) setFacts(JSON.parse(savedFacts));
      const savedTopics = localStorage.getItem('insight-agent:user-topics');
      if (savedTopics) setTopics(JSON.parse(savedTopics));
    } catch {
      /* Fallback auf Defaults */
    }
  }, []);

  const saveName = (val: string) => {
    const trimmed = val.trim() || 'Lokaler Nutzer';
    setDisplayName(trimmed);
    setIsEditingName(false);
    try {
      localStorage.setItem('insight-agent:user-name', trimmed);
    } catch {}
  };

  const addFact = () => {
    const trimmed = newFact.trim();
    if (!trimmed) return;
    const updated = [...facts, trimmed];
    setFacts(updated);
    setNewFact('');
    setIsAddingFact(false);
    try {
      localStorage.setItem('insight-agent:user-facts', JSON.stringify(updated));
    } catch {}
  };

  const removeFact = (index: number) => {
    const updated = facts.filter((_, i) => i !== index);
    setFacts(updated);
    try {
      localStorage.setItem('insight-agent:user-facts', JSON.stringify(updated));
    } catch {}
  };

  const addTopic = () => {
    const trimmed = newTopic.trim();
    if (!trimmed) return;
    const updated = [...topics, { name: trimmed, count: 1 }];
    setTopics(updated);
    setNewTopic('');
    try {
      localStorage.setItem('insight-agent:user-topics', JSON.stringify(updated));
    } catch {}
  };

  const copyId = () => {
    navigator.clipboard?.writeText('did:insight:' + userId).catch(() => {});
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="relative flex h-full flex-col shadow-[-8px_0_32px_-6px_rgba(0,0,0,0.18)] bg-surface/95 text-fg">
      {/* Header */}
      <header className="relative border-b border-border/80 bg-surface/90 px-4 py-3.5 backdrop-blur-md">
        <div className="animated-line absolute bottom-0 left-0 right-0 h-[2px] opacity-60" />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-sm text-accent shadow-[0_0_10px_rgb(var(--accent)/0.3)] font-bold">
              🪪
            </span>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-fg">Digital ID & Profil</h2>
              <p className="text-[11px] text-muted">Was der Agent über dich weiß</p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border/80 p-1 text-muted hover:border-accent hover:text-fg transition"
              aria-label="Schließen"
            >
              ✕
            </button>
          )}
        </div>
      </header>

      {/* ID Card Header */}
      <div className="border-b border-border/70 p-3.5 bg-surface/60">
        <div className="rounded-2xl border border-border/80 bg-surface/90 p-3.5 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-teal-500 text-white font-bold text-base shadow-sm">
                {displayName.charAt(0).toUpperCase()}
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface bg-emerald-500 shadow-xs" />
              </div>
              <div className="min-w-0">
                {isEditingName ? (
                  <input
                    type="text"
                    defaultValue={displayName}
                    autoFocus
                    onBlur={(e) => saveName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveName(e.currentTarget.value)}
                    className="w-full rounded-md border border-accent bg-bg px-1.5 py-0.5 text-xs text-fg font-semibold outline-none"
                  />
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs text-fg truncate">{displayName}</span>
                    <button
                      type="button"
                      onClick={() => setIsEditingName(true)}
                      className="text-[10px] text-muted hover:text-accent transition"
                      title="Namen bearbeiten"
                    >
                      ✎
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-1 text-[10px] text-muted">
                  <span className="font-mono truncate max-w-[130px]">did:insight:{userId}</span>
                  <button
                    type="button"
                    onClick={copyId}
                    className="text-accent hover:underline ml-0.5"
                    title="ID kopieren"
                  >
                    {copiedId ? '✓' : '⎘'}
                  </button>
                </div>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              Verifiziert
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/60 pt-2.5 text-center text-[10px]">
            <div className="rounded-lg bg-bg/50 py-1.5">
              <span className="block font-bold text-fg text-xs">{conversationCount}</span>
              <span className="text-muted">Unterhaltungen</span>
            </div>
            <div className="rounded-lg bg-bg/50 py-1.5">
              <span className="block font-bold text-fg text-xs">{sourcesCount}</span>
              <span className="text-muted">Quellen belegt</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex border-b border-border/70 px-3 pt-2 text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('memory')}
          className={`flex-1 pb-2 border-b-2 transition text-center ${
            activeTab === 'memory'
              ? 'border-accent text-accent font-semibold'
              : 'border-transparent text-muted hover:text-fg'
          }`}
        >
          🧠 Gedächtnis ({facts.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('topics')}
          className={`flex-1 pb-2 border-b-2 transition text-center ${
            activeTab === 'topics'
              ? 'border-accent text-accent font-semibold'
              : 'border-transparent text-muted hover:text-fg'
          }`}
        >
          🎯 Themen ({topics.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex-1 pb-2 border-b-2 transition text-center ${
            activeTab === 'settings'
              ? 'border-accent text-accent font-semibold'
              : 'border-transparent text-muted hover:text-fg'
          }`}
        >
          ⚙️ Vorlieben
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {activeTab === 'memory' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Gespeicherte Fakten
              </span>
              <button
                type="button"
                onClick={() => setIsAddingFact(true)}
                className="text-xs font-medium text-accent hover:underline flex items-center gap-1"
              >
                + Neu
              </button>
            </div>

            {isAddingFact && (
              <div className="rounded-xl border border-accent/60 bg-surface p-2.5 shadow-xs space-y-2">
                <textarea
                  rows={2}
                  value={newFact}
                  onChange={(e) => setNewFact(e.target.value)}
                  placeholder="z. B. 'Bevorzugt kurze Bulletpoints bei Zusammenfassungen'…"
                  className="w-full resize-none rounded-lg border border-border bg-bg p-2 text-xs text-fg outline-none focus:border-accent"
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setIsAddingFact(false); setNewFact(''); }}
                    className="rounded-lg px-2.5 py-1 text-xs text-muted hover:text-fg"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    onClick={addFact}
                    className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white shadow-xs"
                  >
                    Speichern
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {facts.map((fact, index) => (
                <div
                  key={index}
                  className="group relative rounded-xl border border-border/70 bg-surface/80 p-2.5 text-xs text-fg transition hover:border-accent/60 flex items-start justify-between gap-2 shadow-xs"
                >
                  <p className="leading-relaxed text-muted/90 group-hover:text-fg transition-colors">
                    {fact}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeFact(index)}
                    className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-500 transition px-1 text-xs"
                    title="Löschen"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-muted leading-relaxed">
              💡 Diese Fakten werden bei Anfragen berücksichtigt, um personalisierte Antworten zu liefern.
            </p>
          </div>
        )}

        {activeTab === 'topics' && (
          <div className="space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
              Erkannte Interessengebiete
            </span>

            <div className="flex flex-wrap gap-1.5">
              {topics.map((topic, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-surface px-2.5 py-1 text-xs font-medium text-fg shadow-2xs"
                >
                  <span>{topic.name}</span>
                  <span className="rounded-full bg-accent/15 px-1.5 py-0.2 text-[10px] text-accent font-bold">
                    {topic.count}
                  </span>
                </span>
              ))}
            </div>

            <div className="flex items-center gap-1.5 pt-2">
              <input
                type="text"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTopic()}
                placeholder="Neues Thema hinzufügen…"
                className="flex-1 rounded-xl border border-border bg-bg px-2.5 py-1.5 text-xs text-fg outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={addTopic}
                disabled={!newTopic.trim()}
                className="rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-xs disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-3 text-xs">
            <div className="rounded-xl border border-border/70 bg-surface/70 p-3 space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
                Datenschutz & Identität
              </span>
              <p className="text-xs text-muted leading-relaxed">
                Deine Identität und Gedächtnisfakten sind ausschließlich lokal in deiner SQLite-Datenbank (`data/app.db`) abgelegt.
              </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-surface/70 p-3 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
                Standard-Verhalten
              </span>
              <div className="flex items-center justify-between text-xs py-1 border-b border-border/50">
                <span className="text-muted">Quellen-Zitierung</span>
                <span className="font-semibold text-fg">Lückenlos & Streng</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1 border-b border-border/50">
                <span className="text-muted">Recherche-Limit</span>
                <span className="font-semibold text-fg">Hard-Budget aktiv</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-muted">Identitäts-Schlüssel</span>
                <span className="font-mono text-[10px] text-muted">did:insight:usr_local</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import type { SourceRecord } from '@/lib/contracts/domain';

interface Props {
  sources: SourceRecord[];
  highlighted: number | null;
  conflictIndexes: Set<number>;
  excerptsBySource: Map<string, { id: string; text: string }[]>;
  onClose?: () => void;
}

function trustLabel(score: number): { text: string; className: string } {
  if (score >= 0.7) {
    return {
      text: 'hoch',
      className: 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium',
    };
  }
  if (score >= 0.45) {
    return {
      text: 'mittel',
      className: 'border border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300 font-medium',
    };
  }
  return {
    text: 'niedrig',
    className: 'border border-red-500/30 bg-red-500/15 text-red-700 dark:text-red-300 font-medium',
  };
}

export function SourcesPanel({ sources, highlighted, conflictIndexes, excerptsBySource, onClose }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const usable = sources.filter((s) => s.status === 'fetched').sort((a, b) => a.indexNum - b.indexNum);
  const unusable = sources.filter((s) => s.status !== 'fetched');
  const excerptCount = Array.from(excerptsBySource.values()).reduce((n, list) => n + list.length, 0);

  if (sources.length === 0) {
    return (
      <div className="relative flex h-full flex-col shadow-[-8px_0_32px_-6px_rgba(0,0,0,0.18)]">
        <header className="relative border-b border-border/80 bg-surface/90 px-4 py-3.5 backdrop-blur-md">
          <div className="animated-line absolute bottom-0 left-0 right-0 h-[2px] opacity-60" />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent/15 text-xs text-accent shadow-[0_0_10px_rgb(var(--accent)/0.3)] font-bold">
                📚
              </span>
              <h2 className="text-sm font-bold tracking-tight text-fg">Quellen & Belege</h2>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border/80 p-1 text-muted hover:border-accent hover:text-fg transition text-xs"
                aria-label="Schließen"
              >
                ✕
              </button>
            )}
          </div>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-xs text-muted">
          <span className="text-3xl mb-2.5 opacity-60">📖</span>
          <p className="font-semibold text-fg/90">Noch keine Quellen aktiv</p>
          <p className="mt-1.5 max-w-[200px] text-[11px] leading-relaxed text-muted">
            Starte eine Recherche mit Websuche, um verifizierte Zitate und Quellentexte hier anzuzeigen.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col shadow-[-8px_0_32px_-6px_rgba(0,0,0,0.18)]">
      <header className="relative border-b border-border/80 bg-surface/90 px-4 py-3.5 backdrop-blur-md">
        <div className="animated-line absolute bottom-0 left-0 right-0 h-[2px] opacity-60" />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent/15 text-xs text-accent shadow-[0_0_10px_rgb(var(--accent)/0.3)] font-bold">
              📚
            </span>
            <h2 className="text-sm font-bold tracking-tight text-fg">Quellen & Belege</h2>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border/80 p-1 text-muted hover:border-accent hover:text-fg transition text-xs"
              aria-label="Schließen"
            >
              ✕
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">
          {usable.length} verifizierte Quellen · {excerptCount} Zitate
          {conflictIndexes.size > 0 ? ` · ${conflictIndexes.size} mit Abweichung` : ''}
        </p>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-3.5">
        {usable.map((source) => {
          const trust = trustLabel(source.trustScore);
          const excerpts = excerptsBySource.get(source.id) ?? [];
          const isOpen = expanded === source.id;
          const isHighlighted = highlighted === source.indexNum;

          return (
            <article
              key={source.id}
              id={`source-${source.indexNum}`}
              className={`group rounded-2xl border p-4 transition-all duration-200 ${
                isHighlighted
                  ? 'border-accent bg-accent/15 shadow-[0_0_32px_rgb(var(--accent)/0.45),0_12px_32px_rgba(0,0,0,0.18)] ring-2 ring-accent scale-[1.01]'
                  : 'border-border/80 bg-surface/90 shadow-[0_6px_22px_-4px_rgba(0,0,0,0.12)] hover:border-accent/60 hover:bg-surface hover:shadow-[0_12px_32px_-6px_rgba(0,0,0,0.18),0_0_20px_rgb(var(--accent)/0.2)]'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-surface text-xs font-bold text-fg shadow-xs">
                  {source.indexNum}
                </span>
                <div className="min-w-0 flex-1">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="line-clamp-2 text-sm font-semibold text-fg hover:text-accent hover:underline transition-colors"
                    title={source.title}
                  >
                    {source.title}
                  </a>
                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span className="font-semibold text-fg/90">{source.domain}</span>
                    <span>·</span>
                    <span>{source.publishedAt ? source.publishedAt.slice(0, 10) : 'Datum unbekannt'}</span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[11px] shadow-xs ${trust.className}`}>
                      {trust.text}
                    </span>
                    {conflictIndexes.has(source.indexNum) && (
                      <span className="rounded-md border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.2)]">
                        Abweichung
                      </span>
                    )}
                  </p>
                  {excerpts.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : source.id)}
                        className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                      >
                        <span>{isOpen ? '▲ Belege ausblenden' : `▼ ${excerpts.length} Belege anzeigen`}</span>
                      </button>
                      {isOpen && (
                        <ul className="mt-2.5 space-y-2">
                          {excerpts.map((excerpt) => (
                            <li
                              key={excerpt.id}
                              className="rounded-xl border-l-[3px] border-accent bg-surface px-3.5 py-2 text-xs italic text-fg/90 shadow-[0_2px_10px_rgba(0,0,0,0.06),-2px_0_12px_rgb(var(--accent)/0.2)]"
                            >
                              „{excerpt.text.length > 300 ? `${excerpt.text.slice(0, 300)}…` : excerpt.text}“
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              </div>
            </article>
          );
        })}

        {unusable.length > 0 && (
          <details className="rounded-2xl border border-border/70 bg-surface/60 p-3.5 shadow-xs">
            <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-fg">
              {unusable.length} nicht verwendbare Quelle(n)
            </summary>
            <ul className="mt-2.5 space-y-1.5 text-xs text-muted">
              {unusable.map((source) => (
                <li key={source.id} className="rounded-lg border border-border/40 bg-surface/80 px-2.5 py-1.5 shadow-xs">
                  <span className="font-mono text-fg/90 font-medium">{source.domain}</span> — {source.note ?? source.status}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}

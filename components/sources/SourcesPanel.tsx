'use client';

import { useState } from 'react';
import type { SourceRecord } from '@/lib/contracts/domain';

interface Props {
  sources: SourceRecord[];
  highlighted: number | null;
  conflictIndexes: Set<number>;
  excerptsBySource: Map<string, { id: string; text: string }[]>;
}

function trustLabel(score: number): { text: string; className: string } {
  if (score >= 0.7) return { text: 'hoch', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' };
  if (score >= 0.45) return { text: 'mittel', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' };
  return { text: 'niedrig', className: 'bg-red-500/15 text-red-700 dark:text-red-400' };
}

export function SourcesPanel({ sources, highlighted, conflictIndexes, excerptsBySource }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const usable = sources.filter((s) => s.status === 'fetched').sort((a, b) => a.indexNum - b.indexNum);
  const unusable = sources.filter((s) => s.status !== 'fetched');
  const excerptCount = Array.from(excerptsBySource.values()).reduce((n, list) => n + list.length, 0);

  if (sources.length === 0) return null;

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Quellen</h2>
        <p className="mt-0.5 text-xs text-muted">
          {usable.length} Quellen · {excerptCount} Belege
          {conflictIndexes.size > 0 ? ` · ${conflictIndexes.size} mit Abweichung` : ''}
        </p>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {usable.map((source) => {
          const trust = trustLabel(source.trustScore);
          const excerpts = excerptsBySource.get(source.id) ?? [];
          const isOpen = expanded === source.id;
          return (
            <article
              key={source.id}
              id={`source-${source.indexNum}`}
              className={`rounded-lg border p-3 transition-colors ${
                highlighted === source.indexNum ? 'border-accent bg-accent/5' : 'border-border bg-surface'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border text-xs font-medium">
                  {source.indexNum}
                </span>
                <div className="min-w-0 flex-1">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="line-clamp-2 text-sm font-medium hover:underline"
                    title={source.title}
                  >
                    {source.title}
                  </a>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span>{source.domain}</span>
                    <span>·</span>
                    <span>{source.publishedAt ? source.publishedAt.slice(0, 10) : 'Datum unbekannt'}</span>
                    <span className={`rounded px-1.5 py-0.5 ${trust.className}`}>Vertrauen {trust.text}</span>
                    {conflictIndexes.has(source.indexNum) && (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-700 dark:text-amber-400">
                        Abweichung
                      </span>
                    )}
                  </p>
                  {excerpts.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : source.id)}
                        className="mt-2 text-xs text-accent hover:underline"
                      >
                        {isOpen ? 'Belege ausblenden' : `${excerpts.length} Belege anzeigen`}
                      </button>
                      {isOpen && (
                        <ul className="mt-2 space-y-2">
                          {excerpts.map((excerpt) => (
                            <li key={excerpt.id} className="border-l-2 border-border pl-2 text-xs text-muted">
                              {excerpt.text.length > 300 ? `${excerpt.text.slice(0, 300)}…` : excerpt.text}
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
          <details className="rounded-lg border border-border p-3">
            <summary className="cursor-pointer text-xs text-muted">
              {unusable.length} nicht verwendbare Quelle(n)
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-muted">
              {unusable.map((source) => (
                <li key={source.id}>
                  {source.domain} — {source.note ?? source.status}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}

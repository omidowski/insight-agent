'use client';

import { useState } from 'react';
import type { ActivityState } from '@/lib/client/activity-reducer';
import { STATUS_TEXT } from '@/lib/client/activity-reducer';

const KIND_COLOR: Record<string, string> = {
  search: 'text-accent',
  source: 'text-fg',
  compare: 'text-fg',
  warning: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
  plan: 'text-fg',
  status: 'text-muted',
  info: 'text-muted',
};

export function ActivityCard({ state, showCosts }: { state: ActivityState; showCosts: boolean }) {
  const running = !state.finished;
  const [open, setOpen] = useState(true);
  const expanded = running || open;

  return (
    <section
      className="mb-3 overflow-hidden rounded-xl border border-border bg-surface"
      aria-label="Arbeitsschritte des Agenten"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left"
        aria-expanded={expanded}
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${running ? 'bg-accent pulse-dot' : state.status === 'failed' ? 'bg-red-500' : 'bg-emerald-500'}`}
        />
        <span className="text-sm font-medium" aria-live="polite">
          {STATUS_TEXT[state.status]}
        </span>
        <span className="ml-auto text-xs text-muted">
          {state.counters.searches} Suchen · {state.counters.sources} Quellen
          {state.counters.conflicts > 0 ? ` · ${state.counters.conflicts} Abweichungen` : ''}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border px-3.5 py-3">
          {state.steps.length > 0 && (
            <ol className="mb-3 space-y-1.5">
              {state.steps.map((step) => (
                <li key={step.id} className="flex items-start gap-2 text-sm">
                  <span className="mt-[3px] text-xs">
                    {step.status === 'completed' ? '✓' : step.status === 'running' ? '◔' : step.status === 'failed' ? '✕' : '○'}
                  </span>
                  <span className={step.status === 'completed' ? 'text-muted' : ''}>{step.title}</span>
                </li>
              ))}
            </ol>
          )}

          <ul className="max-h-64 space-y-1 overflow-y-auto font-mono text-xs">
            {state.lines.map((line) => (
              <li key={line.id} className={KIND_COLOR[line.kind] ?? 'text-muted'}>
                {line.text}
                {line.count && line.count > 1 ? ` (${line.count}×)` : ''}
              </li>
            ))}
          </ul>

          {state.summary && (
            <p className="mt-3 border-t border-border pt-2 text-xs text-muted">
              {Math.round(state.summary.durationMs / 100) / 10}s · {state.summary.sourceCount} Quellen ·{' '}
              {state.summary.citationCount} Belege · Stopp: {state.summary.stopReason}
              {showCosts ? ` · ${(state.summary.costMicroUsd / 1_000_000).toFixed(4)} USD` : ''}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

'use client';

import { useState } from 'react';
import type { ActivityState } from '@/lib/client/activity-reducer';
import { STATUS_TEXT } from '@/lib/client/activity-reducer';

const KIND_CONFIG: Record<
  string,
  { icon: string; badge: string; pillClass: string; textClass: string }
> = {
  search: {
    icon: '🔍',
    badge: 'Suche',
    pillClass: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/25',
    textClass: 'text-fg',
  },
  source: {
    icon: '📄',
    badge: 'Quelle',
    pillClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/25',
    textClass: 'text-fg',
  },
  compare: {
    icon: '⚖️',
    badge: 'Abgleich',
    pillClass: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/25',
    textClass: 'text-fg',
  },
  warning: {
    icon: '⚠️',
    badge: 'Hinweis',
    pillClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25',
    textClass: 'text-amber-700 dark:text-amber-400',
  },
  error: {
    icon: '✕',
    badge: 'Fehler',
    pillClass: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/25',
    textClass: 'text-red-700 dark:text-red-400',
  },
  plan: {
    icon: '📋',
    badge: 'Plan',
    pillClass: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/25',
    textClass: 'text-fg',
  },
  status: {
    icon: '•',
    badge: 'Status',
    pillClass: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/25',
    textClass: 'text-muted',
  },
  info: {
    icon: 'ℹ',
    badge: 'Info',
    pillClass: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/25',
    textClass: 'text-muted',
  },
};

export function ActivityCard({ state, showCosts }: { state: ActivityState; showCosts: boolean }) {
  const running = !state.finished;
  const [open, setOpen] = useState(true);
  const expanded = running || open;

  return (
    <section
      className={`relative mb-4 overflow-hidden rounded-2xl border transition-all duration-300 ${
        running
          ? 'glow-top-beam active-run-glow border-accent/60 bg-surface/95 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.22),0_0_30px_-4px_rgb(var(--accent)/0.25)]'
          : 'border-border/80 bg-surface/95 shadow-[0_10px_30px_-6px_rgba(0,0,0,0.14),0_0_16px_-2px_rgb(var(--accent)/0.08)]'
      }`}
      aria-label="Arbeitsschritte des Agenten"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-bg/40"
        aria-expanded={expanded}
      >
        <span
          className={`h-3 w-3 shrink-0 rounded-full ${
            running
              ? 'bg-accent glow-pulse-ring'
              : state.status === 'failed'
                ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'
                : state.status === 'cancelled'
                  ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                  : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
          }`}
        />
        <span className="text-sm font-bold tracking-tight text-fg" aria-live="polite">
          {STATUS_TEXT[state.status]}
        </span>
        <span className="ml-auto flex items-center gap-2 text-xs text-muted">
          <span className="rounded-md border border-border/80 bg-bg/80 px-2 py-0.5 font-medium shadow-xs">
            {state.counters.searches} Suchen
          </span>
          <span>·</span>
          <span className="rounded-md border border-border/80 bg-bg/80 px-2 py-0.5 font-medium shadow-xs">
            {state.counters.sources} Quellen
          </span>
          {state.counters.conflicts > 0 ? (
            <>
              <span>·</span>
              <span className="rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.2)] dark:text-amber-400">
                {state.counters.conflicts} Abweichungen
              </span>
            </>
          ) : null}
          <span className="ml-1 text-[11px] text-muted">{expanded ? '▲' : '▼'}</span>
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border/70 bg-bg/40 px-4 py-3.5 backdrop-blur-sm">
          {state.steps.length > 0 && (
            <ol className="relative mb-4 space-y-2 pl-2 before:absolute before:bottom-2 before:left-[17px] before:top-2 before:w-[2px] before:bg-gradient-to-b before:from-accent before:via-border/60 before:to-transparent">
              {state.steps.map((step) => {
                const isDone = step.status === 'completed';
                const isRunning = step.status === 'running';
                const isFail = step.status === 'failed';
                return (
                  <li
                    key={step.id}
                    className={`relative flex items-center gap-3 rounded-xl border px-3 py-2 text-xs transition-all ${
                      isRunning
                        ? 'border-accent bg-accent/15 font-semibold text-fg shadow-[0_0_18px_rgb(var(--accent)/0.3)] ring-1 ring-accent/40'
                        : isDone
                          ? 'border-border/60 bg-surface/80 text-fg/80 shadow-xs'
                          : isFail
                            ? 'border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400'
                            : 'border-border/40 bg-surface/40 text-muted'
                    }`}
                  >
                    <span
                      className={`relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        isRunning
                          ? 'bg-accent text-white shadow-[0_0_12px_rgb(var(--accent))] animate-pulse'
                          : isDone
                            ? 'bg-emerald-500/20 text-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.3)] ring-1 ring-emerald-500/40 dark:text-emerald-400'
                            : isFail
                              ? 'bg-red-500/20 text-red-600 ring-1 ring-red-500/40 dark:text-red-400'
                              : 'border border-border/80 bg-surface text-muted'
                      }`}
                    >
                      {isDone ? '✓' : isRunning ? '▶' : isFail ? '✕' : '○'}
                    </span>
                    <span className="truncate">{step.title}</span>
                  </li>
                );
              })}
            </ol>
          )}

          <ul className="max-h-64 space-y-2 overflow-y-auto pr-1 text-xs">
            {state.lines.map((line) => {
              const config = KIND_CONFIG[line.kind] ?? KIND_CONFIG.info!;
              return (
                <li
                  key={line.id}
                  className="flex items-baseline gap-2.5 rounded-xl border border-border/60 bg-surface/85 px-3 py-2 shadow-xs transition-all hover:border-accent/50 hover:bg-surface hover:shadow-[0_4px_16px_-2px_rgb(var(--accent)/0.2)]"
                >
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-xs ${config.pillClass}`}
                  >
                    <span>{config.icon}</span>
                    <span>{config.badge}</span>
                  </span>
                  <span className={`min-w-0 flex-1 break-words font-mono text-[11px] leading-relaxed ${config.textClass}`}>
                    {line.text}
                  </span>
                  {line.count && line.count > 1 ? (
                    <span className="shrink-0 rounded-full border border-border/80 bg-bg px-2 py-0.5 text-[10px] font-semibold text-muted shadow-xs">
                      {line.count}×
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {state.summary && (
            <div className="mt-3.5 flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-surface/70 px-3.5 py-2 text-xs text-muted shadow-xs">
              <span className="font-semibold text-fg/80">{Math.round(state.summary.durationMs / 100) / 10}s Dauer</span>
              <span>·</span>
              <span>{state.summary.sourceCount} Quellen</span>
              <span>·</span>
              <span>{state.summary.citationCount} Belege</span>
              <span>·</span>
              <span>Stopp: {state.summary.stopReason}</span>
              {showCosts ? (
                <>
                  <span>·</span>
                  <span className="font-semibold text-accent">
                    {(state.summary.costMicroUsd / 1_000_000).toFixed(4)} USD
                  </span>
                </>
              ) : null}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

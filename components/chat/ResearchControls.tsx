'use client';

import { useMemo } from 'react';
import type { Mode } from '@/lib/client/types';
import type {
  ResearchDepth,
  ResearchOptions,
  ResearchOutputFormat,
  ResearchTimeframe,
} from '@/lib/contracts/domain';

interface Props {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  options: ResearchOptions;
  onOptionsChange: (options: ResearchOptions) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  disabled?: boolean;
}

const MODES: { id: Mode; label: string; icon: string; title: string }[] = [
  { id: 'auto', label: 'Auto', icon: '⚡', title: 'Agent wählt automatisch zwischen Chat und Recherche' },
  { id: 'research', label: 'Deep Research', icon: '🔬', title: 'Mehrstufige, tiefgründige Recherche mit Quellen' },
  { id: 'web_lookup', label: 'Schnellsuche', icon: '🔍', title: 'Gezielte Kurzinformation mit 1-2 Quellen' },
  { id: 'chat', label: 'Chat', icon: '💬', title: 'Direkte Modellantwort ohne Websuche' },
];

const ASPECT_SUGGESTIONS = [
  'Finanzdaten & Kennzahlen',
  'Technischer Vergleich',
  'Vor- & Nachteile',
  'Aktuelle Entwicklung (2025/2026)',
  'Regulatorische Hürden & Risiken',
];

const PREFERRED_DOMAIN_SUGGESTIONS = ['wikipedia.org', 'arxiv.org', 'reuters.com', 'github.com'];
const EXCLUDED_DOMAIN_SUGGESTIONS = ['reddit.com', 'pinterest.com', 'quora.com'];

export function ResearchControls({
  mode,
  onModeChange,
  options,
  onOptionsChange,
  isOpen,
  onToggleOpen,
  disabled,
}: Props) {
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (options.depth && options.depth !== 'standard') count++;
    if (options.timeframe && options.timeframe !== 'all') count++;
    if (options.outputFormat && options.outputFormat !== 'standard') count++;
    if (options.aspects && options.aspects.trim().length > 0) count++;
    if (options.focusDomains && options.focusDomains.length > 0) count++;
    if (options.excludeDomains && options.excludeDomains.length > 0) count++;
    return count;
  }, [options]);

  const updateOption = <K extends keyof ResearchOptions>(key: K, value: ResearchOptions[K]) => {
    onOptionsChange({
      ...options,
      [key]: value,
    });
  };

  const addAspect = (suggestion: string) => {
    const current = options.aspects?.trim() ?? '';
    if (!current) {
      updateOption('aspects', suggestion);
    } else if (!current.includes(suggestion)) {
      updateOption('aspects', `${current}, ${suggestion}`);
    }
  };

  const addDomain = (type: 'focusDomains' | 'excludeDomains', domain: string) => {
    const list = options[type] ?? [];
    if (!list.includes(domain)) {
      updateOption(type, [...list, domain]);
    }
  };

  const removeDomain = (type: 'focusDomains' | 'excludeDomains', domain: string) => {
    const list = options[type] ?? [];
    updateOption(type, list.filter((d) => d !== domain));
  };

  const resetOptions = () => {
    onOptionsChange({
      depth: 'standard',
      timeframe: 'all',
      outputFormat: 'standard',
      aspects: undefined,
      focusDomains: undefined,
      excludeDomains: undefined,
    });
  };

  return (
    <div className="w-full">
      {/* Obere Schnell-Leiste: Modus-Pills & Erweiterungsschalter */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5 px-0.5">
        <div className="flex flex-wrap items-center gap-1">
          {MODES.map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                disabled={disabled}
                onClick={() => onModeChange(m.id)}
                title={m.title}
                className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-medium transition-all ${
                  active
                    ? 'bg-accent text-white shadow-[0_2px_8px_rgb(var(--accent)/0.3)]'
                    : 'border border-border/80 bg-surface/80 text-muted hover:border-border hover:bg-surface hover:text-fg'
                }`}
              >
                <span>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Schalter für Recherche-Einstellungen */}
        <button
          type="button"
          disabled={disabled || mode === 'chat'}
          onClick={onToggleOpen}
          aria-expanded={isOpen}
          title={
            mode === 'chat'
              ? 'Im Chat-Modus wird keine Websuche durchgeführt'
              : 'Detaillierte Recherche-Vorgaben einstellen'
          }
          className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-medium transition-all ${
            isOpen
              ? 'border-accent bg-accent/10 text-accent'
              : activeFiltersCount > 0
              ? 'border-accent/60 bg-surface text-accent'
              : 'border-border/80 bg-surface/80 text-muted hover:border-border hover:text-fg'
          } ${mode === 'chat' ? 'cursor-not-allowed opacity-40' : ''}`}
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
          </svg>
          <span>Recherche verfeinern</span>
          {activeFiltersCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
              {activeFiltersCount}
            </span>
          )}
          <span className="text-[10px] text-muted">{isOpen ? '▲' : '▼'}</span>
        </button>
      </div>

      {/* Ausklappbares Spezifikations-Panel */}
      {isOpen && mode !== 'chat' && (
        <div className="mb-3 rounded-2xl border border-border/90 bg-surface/95 p-3.5 shadow-sm backdrop-blur-md transition-all">
          <div className="mb-2.5 flex items-center justify-between border-b border-border/60 pb-2">
            <div>
              <p className="text-xs font-semibold text-fg">Recherche-Spezifikation</p>
              <p className="text-[11px] text-muted">
                Lege Schwerpunkte, vertrauenswürdige Quellen und Zeitrahmen exakt fest.
              </p>
            </div>
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={resetOptions}
                className="text-[11px] text-muted underline-offset-2 hover:text-accent hover:underline"
              >
                Zurücksetzen
              </button>
            )}
          </div>

          <div className="space-y-3">
            {/* 1. Fokus & Kernaspekte */}
            <div>
              <label htmlFor="aspects-input" className="block text-[11px] font-semibold text-fg">
                🎯 Fokus & Kernaspekte
              </label>
              <input
                id="aspects-input"
                type="text"
                value={options.aspects ?? ''}
                onChange={(e) => updateOption('aspects', e.target.value)}
                placeholder="z. B. Finanzzahlen 2024, technischer Vergleich, Vor- und Nachteile …"
                className="mt-1 w-full rounded-xl border border-border bg-bg/60 px-3 py-1.5 text-xs text-fg outline-none transition focus:border-accent"
              />
              <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px] text-muted">
                <span>Vorschläge:</span>
                {ASPECT_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addAspect(s)}
                    className="rounded-md border border-border/80 bg-surface px-1.5 py-0.5 transition hover:border-accent hover:text-accent"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Quellen-Steuerung (Bevorzugte & Auszuschließende Domains) */}
            <div className="grid gap-2.5 sm:grid-cols-2">
              {/* Bevorzugte Domains */}
              <div>
                <label className="block text-[11px] font-semibold text-fg">
                  🌐 Bevorzugte Quellen (Domains)
                </label>
                <div className="mt-1 flex flex-wrap items-center gap-1 rounded-xl border border-border bg-bg/60 p-1.5 min-h-[34px]">
                  {options.focusDomains?.map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center gap-1 rounded-md bg-teal-500/15 px-1.5 py-0.5 text-[10px] font-medium text-teal-700 dark:text-teal-300"
                    >
                      {d}
                      <button
                        type="button"
                        onClick={() => removeDomain('focusDomains', d)}
                        className="hover:text-red-500"
                        title="Domain entfernen"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    placeholder={
                      options.focusDomains?.length ? 'Weitere …' : 'z. B. reuters.com, arxiv.org'
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const val = e.currentTarget.value.trim().toLowerCase().replace(/^https?:\/\//, '');
                        if (val) {
                          addDomain('focusDomains', val);
                          e.currentTarget.value = '';
                        }
                      }
                    }}
                    className="flex-1 bg-transparent px-1 text-xs text-fg outline-none min-w-[100px]"
                  />
                </div>
                <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                  {PREFERRED_DOMAIN_SUGGESTIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => addDomain('focusDomains', d)}
                      className="text-muted hover:text-accent"
                    >
                      +{d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auszuschließende Domains */}
              <div>
                <label className="block text-[11px] font-semibold text-fg">
                  🚫 Auszuschließende Domains
                </label>
                <div className="mt-1 flex flex-wrap items-center gap-1 rounded-xl border border-border bg-bg/60 p-1.5 min-h-[34px]">
                  {options.excludeDomains?.map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center gap-1 rounded-md bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-300"
                    >
                      {d}
                      <button
                        type="button"
                        onClick={() => removeDomain('excludeDomains', d)}
                        className="hover:text-red-600"
                        title="Domain entfernen"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    placeholder={
                      options.excludeDomains?.length ? 'Weitere …' : 'z. B. reddit.com, pinterest.com'
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const val = e.currentTarget.value.trim().toLowerCase().replace(/^https?:\/\//, '');
                        if (val) {
                          addDomain('excludeDomains', val);
                          e.currentTarget.value = '';
                        }
                      }
                    }}
                    className="flex-1 bg-transparent px-1 text-xs text-fg outline-none min-w-[100px]"
                  />
                </div>
                <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                  {EXCLUDED_DOMAIN_SUGGESTIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => addDomain('excludeDomains', d)}
                      className="text-muted hover:text-red-500"
                    >
                      +{d}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Parameter: Tiefe, Zeithorizont, Format */}
            <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-3">
              <div>
                <label htmlFor="select-depth" className="block text-[11px] font-semibold text-fg">
                  Recherche-Tiefe
                </label>
                <select
                  id="select-depth"
                  value={options.depth ?? 'standard'}
                  onChange={(e) => updateOption('depth', e.target.value as ResearchDepth)}
                  className="mt-1 w-full rounded-xl border border-border bg-bg/80 px-2.5 py-1.5 text-xs text-fg outline-none transition focus:border-accent"
                >
                  <option value="quick">⚡ Schnell (1-2 Quellen)</option>
                  <option value="standard">⚖️ Standard (Ausgewogen)</option>
                  <option value="deep">🔬 Tiefgründig (Deep Dive)</option>
                </select>
              </div>

              <div>
                <label htmlFor="select-timeframe" className="block text-[11px] font-semibold text-fg">
                  Zeithorizont (Aktualität)
                </label>
                <select
                  id="select-timeframe"
                  value={options.timeframe ?? 'all'}
                  onChange={(e) => updateOption('timeframe', e.target.value as ResearchTimeframe)}
                  className="mt-1 w-full rounded-xl border border-border bg-bg/80 px-2.5 py-1.5 text-xs text-fg outline-none transition focus:border-accent"
                >
                  <option value="all">Beliebig (Alle Quellen)</option>
                  <option value="day">Letzte 24 Stunden</option>
                  <option value="week">Letzte 7 Tage</option>
                  <option value="month">Letzter Monat</option>
                  <option value="year">Letztes Jahr</option>
                </select>
              </div>

              <div>
                <label htmlFor="select-format" className="block text-[11px] font-semibold text-fg">
                  Ausgabeformat
                </label>
                <select
                  id="select-format"
                  value={options.outputFormat ?? 'standard'}
                  onChange={(e) => updateOption('outputFormat', e.target.value as ResearchOutputFormat)}
                  className="mt-1 w-full rounded-xl border border-border bg-bg/80 px-2.5 py-1.5 text-xs text-fg outline-none transition focus:border-accent"
                >
                  <option value="standard">Standard (Strukturiert)</option>
                  <option value="detailed_report">Ausführlicher Bericht</option>
                  <option value="comparison_table">Vergleichstabelle</option>
                  <option value="bullet_points">Kompakte Stichpunkte</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-end border-t border-border/50 pt-2">
            <button
              type="button"
              onClick={onToggleOpen}
              className="rounded-lg bg-surface px-3 py-1 text-xs font-medium text-fg border border-border hover:bg-bg"
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

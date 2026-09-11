import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { getConfig, resetConfig } from '@/lib/config/env';
import { createLogger } from '@/lib/util/logger';
import { redact } from '@/lib/util/errors';

const ORIGINAL = { ...process.env };

describe('Spec 43 — Configuration', () => {
  beforeEach(() => resetConfig());
  afterEach(() => {
    process.env = { ...ORIGINAL };
    resetConfig();
  });

  it('AC-43-01: ohne Schlüssel gilt die App als nicht konfiguriert, Defaults greifen', () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.NVIDIA_API_KEY;
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_BASE_URL;
    process.env.LLM_PROVIDER = 'auto';
    const config = getConfig();
    expect(config.isConfigured).toBe(false);
    expect(config.llmProvider).toBe('none');
    expect(config.MAX_RESEARCH_ITERATIONS).toBe(3);
    expect(config.defaultBudgets.maxCostMicroUsd).toBe(500_000);
  });

  it('ADR-013: ein NVIDIA-Schlüssel aktiviert den kompatiblen Anbieter', () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_BASE_URL;
    delete process.env.NVIDIA_MODEL_MAIN;
    delete process.env.NVIDIA_MODEL_FAST;
    process.env.LLM_PROVIDER = 'auto';
    process.env.NVIDIA_API_KEY = 'nvapi-test';
    const config = getConfig();
    expect(config.llmProvider).toBe('nvidia');
    expect(config.isConfigured).toBe(true);
    expect(config.activeModelMain.length).toBeGreaterThan(0);
  });

  it('AC-43-02: ungültige Werte brechen mit Variablennamen ab', () => {
    process.env.MAX_RUN_COST_USD = 'abc';
    expect(() => getConfig()).toThrow(/MAX_RUN_COST_USD/);
  });

  it('fehlender Anbieter-Key wird gemeldet', () => {
    process.env.MAX_RUN_COST_USD = '0.5';
    process.env.SEARCH_PROVIDER = 'brave';
    delete process.env.BRAVE_API_KEY;
    expect(() => getConfig()).toThrow(/BRAVE_API_KEY/);
  });

  it('expliziter LLM_PROVIDER ohne passenden Schlüssel bricht ab', () => {
    process.env.MAX_RUN_COST_USD = '0.5';
    process.env.SEARCH_PROVIDER = 'auto';
    delete process.env.NVIDIA_API_KEY;
    process.env.LLM_PROVIDER = 'nvidia';
    expect(() => getConfig()).toThrow(/NVIDIA_API_KEY/);
  });
});

describe('Spec 40 — Observability', () => {
  it('AC-40-01: Secrets werden redigiert', () => {
    expect(redact('token sk-live-abcdefgh im Text')).toContain('[redacted]');
    expect(redact('Authorization: Bearer abcdefghijkl')).toContain('[redacted]');
  });

  it('AC-40-02: Loglevel filtert', () => {
    const written: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    process.env.LOG_LEVEL = 'warn';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.stdout as any).write = (chunk: string) => { written.push(String(chunk)); return true; };
    createLogger({ module: 'test' }).info('unsichtbar');
    (process.stdout as unknown as { write: typeof original }).write = original;
    process.env.LOG_LEVEL = 'error';
    expect(written.join('')).not.toContain('unsichtbar');
  });

  it('erzeugt gültiges JSON und maskiert Schlüsselfelder', () => {
    const written: string[] = [];
    const original = process.stderr.write.bind(process.stderr);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.stderr as any).write = (chunk: string) => { written.push(String(chunk)); return true; };
    createLogger().error('problem', { api_key: 'geheim', runId: 'run_1' });
    (process.stderr as unknown as { write: typeof original }).write = original;
    const parsed = JSON.parse(written.join('')) as Record<string, unknown>;
    expect(parsed.api_key).toBe('[redacted]');
    expect(parsed.runId).toBe('run_1');
  });
});

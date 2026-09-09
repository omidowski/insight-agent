import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HermesCliProvider } from '@/lib/llm/hermes-cli';
import { resetConfig } from '@/lib/config/env';
import type { UsageRecord } from '@/lib/llm/provider';

// fileURLToPath statt .pathname: der Projektpfad enthält ein Leerzeichen, das sonst als %20 ankommt.
const STUB = fileURLToPath(new URL('../doubles/fake-hermes.sh', import.meta.url));
const STATE = '/tmp/hermes_stub_state_test';

beforeEach(() => {
  process.env.LLM_PROVIDER = 'hermes';
  process.env.HERMES_BIN = STUB;
  process.env.HERMES_MODEL_FAST = 'meta/llama-3.3-70b-instruct';
  process.env.HERMES_MODEL_MAIN = 'meta/llama-3.3-70b-instruct';
  process.env.HERMES_STUB_STATE = STATE;
  delete process.env.HERMES_STUB_MODE;
  rmSync(STATE, { force: true });
  resetConfig();
});

afterEach(() => {
  delete process.env.LLM_PROVIDER;
  delete process.env.HERMES_BIN;
  delete process.env.HERMES_STUB_MODE;
  rmSync(STATE, { force: true });
  resetConfig();
});

describe('ADR-015 — Hermes-CLI als Provider', () => {
  it('ruft die CLI auf, liefert Text und entfernt Sitzungsinformationen', async () => {
    const usage: UsageRecord[] = [];
    const provider = new HermesCliProvider((u) => usage.push(u));
    const result = await provider.generateText({
      system: 'Du bist hilfreich.', input: [{ role: 'user', text: 'Hallo' }],
      purpose: 'conversation', model: 'main',
    });
    expect(result.text).toContain('Antwort auf:');
    expect(result.text).not.toContain('Session id');
    expect(result.model).toBe('meta/llama-3.3-70b-instruct');
    expect(usage[0]?.estimated).toBe(true);
  }, 30000);

  it('AC-06-05: das gewählte Modell wird an die CLI durchgereicht', async () => {
    const provider = new HermesCliProvider();
    const result = await provider.generateText({
      system: 's', input: [{ role: 'user', text: 'x' }], purpose: 'router',
      modelName: 'qwen/qwen2.5-coder-32b-instruct',
    });
    expect(result.text).toContain('Modell qwen/qwen2.5-coder-32b-instruct');
  }, 30000);

  it('liest Structured Output auch aus einem Markdown-Codeblock', async () => {
    process.env.HERMES_STUB_MODE = 'json';
    const provider = new HermesCliProvider();
    const result = await provider.generateObject({
      system: 's', input: [{ role: 'user', text: 'x' }], purpose: 'router',
      schema: z.object({ taskType: z.string(), confidence: z.number() }), schemaName: 'router',
    });
    expect(result.taskType).toBe('deep_research');
  }, 30000);

  it('wiederholt bei ungültigem JSON genau einmal', async () => {
    process.env.HERMES_STUB_MODE = 'badjson_then_good';
    const provider = new HermesCliProvider();
    const result = await provider.generateObject({
      system: 's', input: [{ role: 'user', text: 'x' }], purpose: 'plan',
      schema: z.object({ wert: z.string() }), schemaName: 'plan',
    });
    expect(result.wert).toBe('ok');
    expect(existsSync(STATE)).toBe(true);
  }, 30000);

  it('meldet fehlende Hermes-Zugangsdaten mit Handlungshinweis', async () => {
    process.env.HERMES_STUB_MODE = 'unconfigured';
    const provider = new HermesCliProvider();
    await expect(
      provider.generateText({ system: 's', input: [{ role: 'user', text: 'x' }], purpose: 'router' }),
    ).rejects.toMatchObject({
      appError: { code: 'LLM_NOT_CONFIGURED', retryable: false, userMessage: expect.stringContaining('~/.hermes/.env') },
    });
  }, 30000);

  it('erkennt erschöpftes Kontingent', async () => {
    process.env.HERMES_STUB_MODE = 'quota';
    const provider = new HermesCliProvider();
    await expect(
      provider.generateText({ system: 's', input: [{ role: 'user', text: 'x' }], purpose: 'router' }),
    ).rejects.toMatchObject({ appError: { retryable: false, userMessage: expect.stringContaining('Kontingent') } });
  }, 30000);

  it('erkennt abgelehnte Zugangsdaten', async () => {
    process.env.HERMES_STUB_MODE = 'unauthorized';
    const provider = new HermesCliProvider();
    await expect(
      provider.generateText({ system: 's', input: [{ role: 'user', text: 'x' }], purpose: 'router' }),
    ).rejects.toMatchObject({ appError: { userMessage: expect.stringContaining('abgelehnt') } });
  }, 30000);

  it('meldet eine leere Antwort als LLM_BAD_OUTPUT', async () => {
    process.env.HERMES_STUB_MODE = 'empty';
    const provider = new HermesCliProvider();
    await expect(
      provider.generateText({ system: 's', input: [{ role: 'user', text: 'x' }], purpose: 'router' }),
    ).rejects.toMatchObject({ appError: { code: 'LLM_BAD_OUTPUT' } });
  }, 30000);

  it('meldet eine fehlende CLI verständlich', async () => {
    process.env.HERMES_BIN = '/pfad/gibt/es/nicht/hermes';
    resetConfig();
    const provider = new HermesCliProvider();
    await expect(
      provider.generateText({ system: 's', input: [{ role: 'user', text: 'x' }], purpose: 'router' }),
    ).rejects.toMatchObject({
      appError: { code: 'LLM_UNAVAILABLE', userMessage: expect.stringContaining('HERMES_BIN') },
    });
  }, 30000);

  it('streamt die fertige Antwort in Stücken', async () => {
    const provider = new HermesCliProvider();
    let text = '';
    let chunks = 0;
    for await (const delta of provider.streamText({
      system: 's', input: [{ role: 'user', text: 'x' }], purpose: 'synthesis',
    })) {
      text += delta;
      chunks++;
    }
    expect(chunks).toBeGreaterThan(0);
    expect(text).toContain('Antwort auf:');
  }, 30000);
});

describe('ADR-015 — Hermes meldet fehlende Anbieter-Zugangsdaten', () => {
  it('erkennt "No usable credentials found" als Konfigurationsfehler', async () => {
    process.env.HERMES_STUB_MODE = 'no_credentials';
    const provider = new HermesCliProvider();
    await expect(
      provider.generateText({ system: 's', input: [{ role: 'user', text: 'x' }], purpose: 'router' }),
    ).rejects.toMatchObject({
      appError: { code: 'LLM_NOT_CONFIGURED', retryable: false, userMessage: expect.stringContaining('set-key') },
    });
  }, 30000);
});

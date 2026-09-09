/**
 * LLM-Provider über die Hermes-Agent-CLI (Spec 06, ADR-015).
 *
 * Die Zugangsdaten liegen dabei in Hermes (`~/.hermes/.env`), nicht in der `.env.local`
 * dieser Anwendung. Hermes spricht seinerseits den gewählten Anbieter an — für NVIDIA NIM
 * ist das der eingebaute Provider `nvidia`.
 *
 * Bewusste Einschränkungen gegenüber den HTTP-Providern:
 * - Kein echtes Token-Streaming: die CLI liefert die fertige Antwort, die hier in Stücken
 *   nachgereicht wird. Die Oberfläche verhält sich gleich, der erste Text kommt aber später.
 * - Keine Verbrauchsdaten vom Anbieter: Token und Kosten werden geschätzt.
 * - Structured Outputs entstehen über Schema-Anweisung im Prompt plus Reparaturversuch.
 */
import { spawn } from 'node:child_process';
import type { z } from 'zod';
import type { LLMProvider, ObjectRequest, TextRequest, TextResult, UsageSink } from './provider';
import { getConfig } from '@/lib/config/env';
import { appError, AppErrorException } from '@/lib/util/errors';
import { estimateTokens } from '@/lib/util/tokens';
import { toStrictJsonSchema } from '@/lib/contracts/json-schema';
import { costMicroUsd } from './pricing';
import { renderInput } from './render';
import { logger } from '@/lib/util/logger';

interface HermesResult {
  stdout: string;
  stderr: string;
  code: number | null;
  timedOut: boolean;
}

/** Hermes hängt bei `--quiet` Sitzungsinformationen an; die gehören nicht in die Antwort. */
function stripSessionInfo(raw: string): string {
  return raw
    .split('\n')
    .filter((line) => !/^\s*(session|Session)\s*(id|ID)?\s*[:=]/.test(line))
    .filter((line) => !/^\s*(Resume with|Fortsetzen mit|hermes chat -r)\b/.test(line))
    .join('\n')
    .trim();
}

export class HermesCliProvider implements LLMProvider {
  readonly name = 'Hermes CLI';

  constructor(private readonly sink?: UsageSink) {}

  private modelFor(req: TextRequest): string {
    if (req.modelName) return req.modelName;
    const config = getConfig();
    return req.model === 'main' ? config.activeModelMain : config.activeModelFast;
  }

  private run(prompt: string, model: string, signal?: AbortSignal): Promise<HermesResult> {
    const config = getConfig();
    const args = [
      'chat',
      '-q', prompt,
      '--quiet',
      '--max-turns', '1',      // keine eigenständige Werkzeugnutzung — die macht diese App selbst
      '--ignore-rules',        // Projektregeln des Repos sollen den Aufruf nicht verändern
    ];
    if (model) args.push('-m', model);
    if (config.HERMES_PROVIDER) args.push('--provider', config.HERMES_PROVIDER);

    return new Promise<HermesResult>((resolve, reject) => {
      const child = spawn(config.HERMES_BIN, args, {
        env: { ...process.env, NO_COLOR: '1', TERM: 'dumb' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let settled = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 5000).unref?.();
      }, config.LLM_TIMEOUT_MS);

      const onAbort = () => {
        child.kill('SIGTERM');
      };
      signal?.addEventListener('abort', onAbort, { once: true });

      const finish = (result: HermesResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        resolve(result);
      };

      child.stdout.on('data', (chunk) => { stdout += String(chunk); });
      child.stderr.on('data', (chunk) => { stderr += String(chunk); });
      child.on('error', (err) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        if (settled) return;
        settled = true;
        reject(
          new AppErrorException(
            appError('LLM_UNAVAILABLE', `Hermes nicht startbar: ${err.message}`, {
              retryable: false,
              userMessage: `Hermes konnte nicht gestartet werden (${config.HERMES_BIN}). Prüfe die Installation und HERMES_BIN in .env.local.`,
            }),
          ),
        );
      });
      child.on('close', (code) => finish({ stdout, stderr, code, timedOut }));
    });
  }

  private interpret(result: HermesResult, model: string, aborted: boolean): string {
    if (aborted) throw new AppErrorException(appError('RUN_CANCELLED', 'aborted'));
    if (result.timedOut) {
      throw new AppErrorException(appError('LLM_TIMEOUT', `Hermes-Zeitüberschreitung (Modell ${model})`));
    }

    const combined = `${result.stdout}\n${result.stderr}`;
    if (/No inference provider configured|set an API key|No usable credentials found/i.test(combined)) {
      throw new AppErrorException(
        appError('LLM_NOT_CONFIGURED', 'Hermes hat keinen Anbieter konfiguriert', {
          retryable: false,
          userMessage:
            'Hermes hat für diesen Anbieter keine Zugangsdaten. Trage den Schlüssel mit „npm run set-key -- --hermes" in ~/.hermes/.env ein.',
        }),
      );
    }
    if (/no credits remaining|insufficient[_ ]quota|exceeded your current quota/i.test(combined)) {
      throw new AppErrorException(
        appError('LLM_UNAVAILABLE', 'Kontingent erschöpft', {
          retryable: false,
          userMessage: 'Das Kontingent des über Hermes genutzten Anbieters ist aufgebraucht.',
        }),
      );
    }
    if (/401|unauthorized|invalid api key/i.test(combined) && result.code !== 0) {
      throw new AppErrorException(
        appError('LLM_UNAVAILABLE', 'Hermes: Zugangsdaten abgelehnt', {
          retryable: false,
          userMessage: 'Der in Hermes hinterlegte Schlüssel wird abgelehnt. Prüfe ihn mit „hermes status".',
        }),
      );
    }

    const text = stripSessionInfo(result.stdout);
    if (result.code !== 0 && text.length === 0) {
      throw new AppErrorException(
        appError('LLM_UNAVAILABLE', `Hermes endete mit Code ${result.code}: ${result.stderr.slice(0, 200)}`),
      );
    }
    if (text.length === 0) {
      throw new AppErrorException(appError('LLM_BAD_OUTPUT', 'Hermes lieferte keine Antwort'));
    }
    return text;
  }

  private record(req: TextRequest, model: string, promptText: string, answer: string): void {
    const inputTokens = estimateTokens(promptText);
    const outputTokens = estimateTokens(answer);
    this.sink?.({
      ...(req.runId ? { runId: req.runId } : {}),
      kind: req.purpose,
      model,
      inputTokens,
      outputTokens,
      costMicroUsd: costMicroUsd(model, inputTokens, outputTokens),
      estimated: true,
    });
  }

  private buildPrompt(req: TextRequest, extra?: string): string {
    const parts = [req.system, extra, renderInput(req.input)].filter(Boolean);
    return parts.join('\n\n');
  }

  async generateText(req: TextRequest): Promise<TextResult> {
    const model = this.modelFor(req);
    const prompt = this.buildPrompt(req);
    const started = Date.now();
    const result = await this.run(prompt, model, req.signal);
    const text = this.interpret(result, model, Boolean(req.signal?.aborted));
    this.record(req, model, prompt, text);
    logger.debug('hermes call', { module: 'llm', purpose: req.purpose, model, ms: Date.now() - started });
    return {
      text,
      model,
      inputTokens: estimateTokens(prompt),
      outputTokens: estimateTokens(text),
      estimated: true,
    };
  }

  /** Kein echtes Streaming: die fertige Antwort wird in Stücken nachgereicht. */
  async *streamText(req: TextRequest): AsyncIterable<string> {
    const { text } = await this.generateText(req);
    for (let i = 0; i < text.length; i += 48) {
      if (req.signal?.aborted) throw new AppErrorException(appError('RUN_CANCELLED', 'aborted'));
      yield text.slice(i, i + 48);
    }
  }

  async generateObject<T>(req: ObjectRequest<T>): Promise<T> {
    const model = this.modelFor(req);
    const schema = toStrictJsonSchema(req.schema as unknown as z.ZodTypeAny);
    const instruction =
      'Antworte ausschließlich mit gültigem JSON nach diesem Schema — ohne Codeblock, ohne Vor- oder Nachtext:\n' +
      JSON.stringify(schema);

    const parse = (raw: string): T => {
      const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      const candidate = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
      const parsed = req.schema.safeParse(JSON.parse(candidate));
      if (!parsed.success) throw new Error(parsed.error.message);
      return parsed.data;
    };

    const first = this.buildPrompt(req, instruction);
    const firstResult = await this.run(first, model, req.signal);
    const firstText = this.interpret(firstResult, model, Boolean(req.signal?.aborted));
    this.record(req, model, first, firstText);

    try {
      return parse(firstText);
    } catch (err) {
      logger.warn('hermes structured output repair', { module: 'llm', purpose: req.purpose });
      const repairPrompt = this.buildPrompt(
        req,
        `${instruction}\n\nDie vorherige Antwort war ungültig (${(err as Error).message.slice(0, 160)}). Gib nur das JSON aus.`,
      );
      const second = await this.run(repairPrompt, model, req.signal);
      const secondText = this.interpret(second, model, Boolean(req.signal?.aborted));
      this.record(req, model, repairPrompt, secondText);
      try {
        return parse(secondText);
      } catch (err2) {
        throw new AppErrorException(
          appError('LLM_BAD_OUTPUT', `Hermes: Schema-Verletzung: ${(err2 as Error).message.slice(0, 200)}`),
        );
      }
    }
  }
}

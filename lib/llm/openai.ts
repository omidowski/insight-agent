/** OpenAI Responses API hinter der Provider-Schnittstelle (Spec 06). */
import OpenAI from 'openai';
import type { z } from 'zod';
import type { LLMProvider, ObjectRequest, TextRequest, TextResult, UsageSink } from './provider';
import { renderInput } from './render';
import { getConfig } from '@/lib/config/env';
import { appError, AppErrorException, withRetry, toAppError } from '@/lib/util/errors';
import { estimateTokens } from '@/lib/util/tokens';
import { toStrictJsonSchema } from '@/lib/contracts/json-schema';
import { costMicroUsd } from './pricing';
import { logger } from '@/lib/util/logger';

/** Bildet Anbieterfehler auf konkrete, behebbare Meldungen ab (Spec 38, FR-38-02). */
function mapError(err: unknown, model?: string): AppErrorException {
  const e = err as { status?: number; name?: string; message?: string; code?: string; error?: { code?: string; message?: string } };
  if (e?.name === 'AbortError') return new AppErrorException(appError('RUN_CANCELLED', 'aborted'));
  if (e?.name === 'TimeoutError') return new AppErrorException(appError('LLM_TIMEOUT', 'timeout'));

  const status = e?.status ?? 0;
  const providerCode = e?.error?.code ?? e?.code ?? '';
  const detail = (e?.error?.message ?? e?.message ?? '').slice(0, 200);

  if (status === 401 || status === 403) {
    return new AppErrorException(
      appError('LLM_UNAVAILABLE', `auth abgelehnt (${status}): ${detail}`, {
        retryable: false,
        userMessage:
          'Der OpenAI-Schlüssel wird abgelehnt (401). Prüfe OPENAI_API_KEY in .env.local und starte den Server neu.',
      }),
    );
  }
  if (status === 404 || providerCode === 'model_not_found') {
    return new AppErrorException(
      appError('LLM_UNAVAILABLE', `Modell nicht verfügbar: ${model ?? '?'} — ${detail}`, {
        retryable: false,
        userMessage: `Das Modell „${model ?? '?'}" ist für diesen Schlüssel nicht freigeschaltet. Setze OPENAI_MODEL_MAIN und OPENAI_MODEL_FAST in .env.local auf ein verfügbares Modell.`,
      }),
    );
  }
  if (providerCode === 'insufficient_quota' || /no credits remaining|insufficient[_ ]quota|exceeded your current quota/i.test(detail)) {
    return new AppErrorException(
      appError('LLM_UNAVAILABLE', `Guthaben erschöpft: ${detail}`, {
        retryable: false,
        userMessage: 'Das OpenAI-Guthaben dieses Kontos ist aufgebraucht. Bitte Abrechnung prüfen.',
      }),
    );
  }
  if (status === 429) {
    return new AppErrorException(appError('LLM_UNAVAILABLE', `Ratelimit (429): ${detail}`));
  }
  if (status >= 500) {
    return new AppErrorException(appError('LLM_UNAVAILABLE', `Anbieterfehler (${status}): ${detail}`));
  }
  if (status >= 400) {
    return new AppErrorException(
      appError('LLM_BAD_OUTPUT', `Anfrage abgelehnt (${status}): ${detail}`, {
        retryable: false,
        userMessage: `Die Anfrage an das Modell wurde abgelehnt (${status}). Details stehen im Serverlog.`,
      }),
    );
  }
  return new AppErrorException(toAppError(err));
}

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  private readonly client: OpenAI;

  constructor(private readonly sink?: UsageSink) {
    const config = getConfig();
    this.client = new OpenAI({
      apiKey: config.OPENAI_API_KEY ?? '',
      timeout: config.LLM_TIMEOUT_MS,
      maxRetries: 0, // Retries übernimmt withRetry (Spec 06, FR-06-03)
    });
  }

  private modelName(req: TextRequest): string {
    if (req.modelName) return req.modelName;
    const config = getConfig();
    return req.model === 'main' ? config.OPENAI_MODEL_MAIN : config.OPENAI_MODEL_FAST;
  }

  private record(req: TextRequest, model: string, inputTokens: number, outputTokens: number, estimated: boolean): void {
    this.sink?.({
      ...(req.runId ? { runId: req.runId } : {}),
      kind: req.purpose, model, inputTokens, outputTokens,
      costMicroUsd: costMicroUsd(model, inputTokens, outputTokens), estimated,
    });
  }

  async generateText(req: TextRequest): Promise<TextResult> {
    const model = this.modelName(req);
    const started = Date.now();
    const response = await withRetry(
      () =>
        this.client.responses.create(
          {
            model,
            instructions: req.system,
            input: renderInput(req.input),
            ...(req.maxOutputTokens ? { max_output_tokens: req.maxOutputTokens } : {}),
          },
          { signal: req.signal as AbortSignal | undefined },
        ).catch((err: unknown) => { throw mapError(err); }),
      { maxAttempts: 2, baseMs: 250, ...(req.signal ? { signal: req.signal } : {}) },
    );
    const text = response.output_text ?? '';
    const usage = response.usage;
    const inputTokens = usage?.input_tokens ?? estimateTokens(renderInput(req.input));
    const outputTokens = usage?.output_tokens ?? estimateTokens(text);
    this.record(req, model, inputTokens, outputTokens, !usage);
    logger.debug('llm call', { module: 'llm', purpose: req.purpose, model, ms: Date.now() - started });
    if (!text.trim()) throw new AppErrorException(appError('LLM_BAD_OUTPUT', 'leere Antwort'));
    return { text, model, inputTokens, outputTokens, estimated: !usage };
  }

  async *streamText(req: TextRequest): AsyncIterable<string> {
    const model = this.modelName(req);
    let stream;
    try {
      stream = await this.client.responses.create(
        {
          model,
          instructions: req.system,
          input: renderInput(req.input),
          stream: true,
          ...(req.maxOutputTokens ? { max_output_tokens: req.maxOutputTokens } : {}),
        },
        { signal: req.signal as AbortSignal | undefined },
      );
    } catch (err) {
      throw mapError(err, model);
    }
    let output = '';
    let inputTokens = 0;
    let outputTokens = 0;
    try {
      for await (const event of stream as AsyncIterable<Record<string, unknown>>) {
        if (req.signal?.aborted) throw new AppErrorException(appError('RUN_CANCELLED', 'aborted'));
        const type = event.type as string | undefined;
        if (type === 'response.output_text.delta' && typeof event.delta === 'string') {
          output += event.delta;
          yield event.delta;
        } else if (type === 'response.completed') {
          const usage = (event.response as { usage?: { input_tokens?: number; output_tokens?: number } } | undefined)?.usage;
          inputTokens = usage?.input_tokens ?? 0;
          outputTokens = usage?.output_tokens ?? 0;
        }
      }
    } catch (err) {
      throw mapError(err, model);
    } finally {
      const estimated = inputTokens === 0;
      this.record(
        req, model,
        inputTokens || estimateTokens(renderInput(req.input)),
        outputTokens || estimateTokens(output),
        estimated,
      );
    }
  }

  async generateObject<T>(req: ObjectRequest<T>): Promise<T> {
    const model = this.modelName(req);
    const schema = toStrictJsonSchema(req.schema as unknown as z.ZodTypeAny);
    const call = async (extraInstruction?: string): Promise<string> => {
      const response = await withRetry(
        () =>
          this.client.responses.create(
            {
              model,
              instructions: extraInstruction ? `${req.system}\n\n${extraInstruction}` : req.system,
              input: renderInput(req.input),
              text: {
                format: {
                  type: 'json_schema',
                  name: req.schemaName,
                  strict: true,
                  schema: schema as unknown as Record<string, unknown>,
                },
              },
              ...(req.maxOutputTokens ? { max_output_tokens: req.maxOutputTokens } : {}),
            } as never,
            { signal: req.signal as AbortSignal | undefined },
          ).catch((err: unknown) => { throw mapError(err, model); }),
        { maxAttempts: 2, baseMs: 250, ...(req.signal ? { signal: req.signal } : {}) },
      );
      const usage = response.usage;
      this.record(
        req, model,
        usage?.input_tokens ?? estimateTokens(renderInput(req.input)),
        usage?.output_tokens ?? 0,
        !usage,
      );
      return response.output_text ?? '';
    };

    const parseOrThrow = (raw: string): T => {
      const json = JSON.parse(raw) as unknown;
      const parsed = req.schema.safeParse(json);
      if (!parsed.success) throw new Error(parsed.error.message);
      return parsed.data;
    };

    const first = await call();
    try {
      return parseOrThrow(first);
    } catch (err) {
      logger.warn('structured output repair', { module: 'llm', purpose: req.purpose });
      const repaired = await call(
        `Die vorherige Antwort war ungültig (${(err as Error).message.slice(0, 200)}). Antworte ausschließlich mit gültigem JSON nach dem Schema.`,
      );
      try {
        return parseOrThrow(repaired);
      } catch (err2) {
        throw new AppErrorException(
          appError('LLM_BAD_OUTPUT', `Schema-Verletzung: ${(err2 as Error).message.slice(0, 200)}`),
        );
      }
    }
  }
}

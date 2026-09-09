/**
 * Provider für OpenAI-kompatible Chat-Completions-Endpunkte (Spec 06, ADR-012).
 * Deckt NVIDIA NIM, Groq, Together, OpenRouter und lokale Server (Ollama, vLLM) ab.
 * Bewusst ohne SDK: nur `fetch`, damit jede kompatible Basis-URL funktioniert.
 */
import type { z } from 'zod';
import type { LLMProvider, ObjectRequest, TextRequest, TextResult, UsageSink } from './provider';
import { getConfig } from '@/lib/config/env';
import { appError, AppErrorException, withRetry, toAppError } from '@/lib/util/errors';
import { estimateTokens } from '@/lib/util/tokens';
import { toStrictJsonSchema } from '@/lib/contracts/json-schema';
import { costMicroUsd } from './pricing';
import { renderInput } from './render';
import { logger } from '@/lib/util/logger';

interface ChatUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

interface ChatResponse {
  choices?: { message?: { content?: string }; finish_reason?: string }[];
  usage?: ChatUsage;
  error?: { message?: string; code?: string };
}

function mapError(status: number, body: unknown, model: string, providerName: string): AppErrorException {
  const parsed = body as { error?: { message?: string; code?: string }; message?: string; detail?: string };
  const detail = (parsed?.error?.message ?? parsed?.message ?? parsed?.detail ?? '').slice(0, 200);
  const code = parsed?.error?.code ?? '';

  if (status === 401 || status === 403) {
    return new AppErrorException(
      appError('LLM_UNAVAILABLE', `${providerName}: auth abgelehnt (${status}): ${detail}`, {
        retryable: false,
        userMessage: `Der Schlüssel für ${providerName} wird abgelehnt (${status}). Prüfe ihn in .env.local.`,
      }),
    );
  }
  if (status === 404 || code === 'model_not_found') {
    return new AppErrorException(
      appError('LLM_UNAVAILABLE', `${providerName}: Modell nicht verfügbar: ${model} — ${detail}`, {
        retryable: false,
        userMessage: `Das Modell „${model}" ist bei ${providerName} nicht verfügbar. Prüfe MODEL_FAST/MODEL_MAIN in .env.local.`,
      }),
    );
  }
  if (code === 'insufficient_quota' || /no credits remaining|insufficient[_ ]quota|exceeded your current quota|credit balance/i.test(detail)) {
    return new AppErrorException(
      appError('LLM_UNAVAILABLE', `${providerName}: Kontingent erschöpft: ${detail}`, {
        retryable: false,
        userMessage: `Das Kontingent bei ${providerName} ist aufgebraucht.`,
      }),
    );
  }
  if (status === 429) {
    return new AppErrorException(appError('LLM_UNAVAILABLE', `${providerName}: Ratelimit (429): ${detail}`));
  }
  if (status >= 500) {
    return new AppErrorException(appError('LLM_UNAVAILABLE', `${providerName}: Anbieterfehler (${status}): ${detail}`));
  }
  return new AppErrorException(
    appError('LLM_BAD_OUTPUT', `${providerName}: Anfrage abgelehnt (${status}): ${detail}`, {
      retryable: false,
      userMessage: `Die Anfrage an ${providerName} wurde abgelehnt (${status}).`,
    }),
  );
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name: string;

  constructor(
    private readonly options: {
      name: string;
      baseUrl: string;
      apiKey: string;
      modelFast: string;
      modelMain: string;
      /** Manche Anbieter unterstützen kein json_schema, nur json_object. */
      structuredOutput: 'json_schema' | 'json_object' | 'prompt';
    },
    private readonly sink?: UsageSink,
  ) {
    this.name = options.name;
  }

  private model(req: TextRequest): string {
    if (req.modelName) return req.modelName;
    return req.model === 'main' ? this.options.modelMain : this.options.modelFast;
  }

  private record(req: TextRequest, model: string, usage: ChatUsage | undefined, fallbackIn: string, fallbackOut: string): void {
    const inputTokens = usage?.prompt_tokens ?? estimateTokens(fallbackIn);
    const outputTokens = usage?.completion_tokens ?? estimateTokens(fallbackOut);
    this.sink?.({
      ...(req.runId ? { runId: req.runId } : {}),
      kind: req.purpose,
      model,
      inputTokens,
      outputTokens,
      costMicroUsd: costMicroUsd(model, inputTokens, outputTokens),
      estimated: !usage,
    });
  }

  /**
   * Reasoning-Modelle denken vor der Antwort sichtbar nach. Das kostet bei Nemotron
   * das Vierfache an Zeit und bringt für Zwischenschritte nichts. NVIDIA akzeptiert
   * beide Schalter; andere Anbieter kennen sie nicht, deshalb nur bei Bedarf.
   */
  private thinkingOff(): Record<string, unknown> {
    const config = getConfig();
    const wanted =
      config.LLM_DISABLE_THINKING === 'on' ||
      (config.LLM_DISABLE_THINKING === 'auto' && config.llmProvider === 'nvidia');
    return wanted ? { chat_template_kwargs: { thinking: false } } : {};
  }

  private async post(body: Record<string, unknown>, signal: AbortSignal | undefined, model: string): Promise<Response> {
    const config = getConfig();
    const timeout = AbortSignal.timeout(config.LLM_TIMEOUT_MS);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let response: Response;
    try {
      response = await fetch(`${this.options.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...this.thinkingOff(), ...body }),
        signal: combined,
      });
    } catch (err) {
      if (signal?.aborted) throw new AppErrorException(appError('RUN_CANCELLED', 'aborted'));
      const e = err as Error;
      if (e.name === 'TimeoutError' || e.name === 'AbortError') {
        throw new AppErrorException(appError('LLM_TIMEOUT', `${this.name}: Zeitüberschreitung`));
      }
      throw new AppErrorException(appError('LLM_UNAVAILABLE', `${this.name}: ${e.message.slice(0, 160)}`));
    }
    if (!response.ok) {
      let parsed: unknown = {};
      try {
        parsed = await response.json();
      } catch {
        /* kein JSON-Body */
      }
      throw mapError(response.status, parsed, model, this.name);
    }
    return response;
  }

  async generateText(req: TextRequest): Promise<TextResult> {
    const model = this.model(req);
    const rendered = renderInput(req.input);
    const response = await withRetry(
      async () =>
        this.post(
          {
            model,
            messages: [
              { role: 'system', content: req.system },
              { role: 'user', content: rendered },
            ],
            ...(req.maxOutputTokens ? { max_tokens: req.maxOutputTokens } : {}),
            ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
          },
          req.signal,
          model,
        ),
      { maxAttempts: 2, baseMs: 250, ...(req.signal ? { signal: req.signal } : {}) },
    );
    const data = (await response.json()) as ChatResponse;
    const text = data.choices?.[0]?.message?.content ?? '';
    this.record(req, model, data.usage, rendered, text);
    if (!text.trim()) throw new AppErrorException(appError('LLM_BAD_OUTPUT', 'leere Antwort'));
    return {
      text,
      model,
      inputTokens: data.usage?.prompt_tokens ?? estimateTokens(rendered),
      outputTokens: data.usage?.completion_tokens ?? estimateTokens(text),
      estimated: !data.usage,
    };
  }

  async *streamText(req: TextRequest): AsyncIterable<string> {
    const model = this.model(req);
    const rendered = renderInput(req.input);
    const response = await this.post(
      {
        model,
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: rendered },
        ],
        stream: true,
        ...(req.maxOutputTokens ? { max_tokens: req.maxOutputTokens } : {}),
      },
      req.signal,
      model,
    );

    const reader = response.body?.getReader();
    if (!reader) throw new AppErrorException(appError('LLM_BAD_OUTPUT', 'kein Antwortstrom'));
    const decoder = new TextDecoder();
    let buffer = '';
    let output = '';
    let usage: ChatUsage | undefined;

    try {
      for (;;) {
        if (req.signal?.aborted) throw new AppErrorException(appError('RUN_CANCELLED', 'aborted'));
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n');
        buffer = parts.pop() ?? '';
        for (const line of parts) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const chunk = JSON.parse(payload) as {
              choices?: { delta?: { content?: string } }[];
              usage?: ChatUsage;
            };
            if (chunk.usage) usage = chunk.usage;
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) {
              output += delta;
              yield delta;
            }
          } catch {
            /* unvollständiger Chunk */
          }
        }
      }
    } finally {
      await reader.cancel().catch(() => undefined);
      this.record(req, model, usage, rendered, output);
    }
  }

  async generateObject<T>(req: ObjectRequest<T>): Promise<T> {
    const model = this.model(req);
    const rendered = renderInput(req.input);
    const jsonSchema = toStrictJsonSchema(req.schema as unknown as z.ZodTypeAny);

    const formatFor = (mode: typeof this.options.structuredOutput): Record<string, unknown> => {
      if (mode === 'json_schema') {
        return {
          response_format: {
            type: 'json_schema',
            json_schema: { name: req.schemaName, strict: true, schema: jsonSchema },
          },
        };
      }
      if (mode === 'json_object') return { response_format: { type: 'json_object' } };
      return {};
    };

    const schemaHint =
      `Antworte ausschließlich mit gültigem JSON nach diesem Schema, ohne Markdown-Codeblock:\n` +
      JSON.stringify(jsonSchema);

    const call = async (mode: typeof this.options.structuredOutput, repairHint?: string): Promise<string> => {
      const response = await this.post(
        {
          model,
          messages: [
            { role: 'system', content: `${req.system}\n\n${schemaHint}${repairHint ? `\n\n${repairHint}` : ''}` },
            { role: 'user', content: rendered },
          ],
          ...formatFor(mode),
          ...(req.maxOutputTokens ? { max_tokens: req.maxOutputTokens } : {}),
        },
        req.signal,
        model,
      );
      const data = (await response.json()) as ChatResponse;
      this.record(req, model, data.usage, rendered, data.choices?.[0]?.message?.content ?? '');
      return data.choices?.[0]?.message?.content ?? '';
    };

    const parse = (raw: string): T => {
      const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      const candidate = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
      const parsed = req.schema.safeParse(JSON.parse(candidate));
      if (!parsed.success) throw new Error(parsed.error.message);
      return parsed.data;
    };

    let mode = this.options.structuredOutput;
    let first: string;
    try {
      first = await call(mode);
    } catch (err) {
      const appErr = toAppError(err);
      // Anbieter kennt json_schema nicht → auf json_object zurückfallen
      if (mode === 'json_schema' && appErr.code === 'LLM_BAD_OUTPUT') {
        logger.warn('structured output fallback auf json_object', { module: 'llm', provider: this.name });
        mode = 'json_object';
        first = await call(mode);
      } else {
        throw err;
      }
    }

    try {
      return parse(first);
    } catch (err) {
      logger.warn('structured output repair', { module: 'llm', purpose: req.purpose, provider: this.name });
      const repaired = await call(mode, `Die vorherige Antwort war ungültig (${(err as Error).message.slice(0, 160)}).`);
      try {
        return parse(repaired);
      } catch (err2) {
        throw new AppErrorException(
          appError('LLM_BAD_OUTPUT', `Schema-Verletzung: ${(err2 as Error).message.slice(0, 200)}`),
        );
      }
    }
  }
}

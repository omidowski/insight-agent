/** Registry und Executor mit Guards, Timeout, Retry, Cache (Spec 18). */
import type { ToolName } from '@/lib/contracts/domain';
import type { ToolContext, ToolDefinition, ToolOutcome } from './types';
import { calculatorTool, datetimeTool } from './utilities';
import { extractContentTool, openUrlTool, searchInPageTool, webSearchTool } from './web';
import { toStrictJsonSchema, type JsonSchema } from '@/lib/contracts/json-schema';
import { appError, toAppError, withRetry } from '@/lib/util/errors';
import { truncateToTokens } from '@/lib/util/tokens';

const ALL_TOOLS: ToolDefinition<never, never>[] = [
  webSearchTool, openUrlTool, extractContentTool, searchInPageTool, calculatorTool, datetimeTool,
] as unknown as ToolDefinition<never, never>[];

const BY_NAME = new Map<ToolName, ToolDefinition<never, never>>(
  ALL_TOOLS.map((t) => [t.name, t]),
);

export function getTool(name: ToolName): ToolDefinition<never, never> | undefined {
  return BY_NAME.get(name);
}

export function getToolsFor(allowed: readonly ToolName[]): ToolDefinition<never, never>[] {
  return ALL_TOOLS.filter((t) => allowed.includes(t.name));
}

export interface ToolSchemaForModel {
  name: ToolName;
  description: string;
  parameters: JsonSchema;
}

export function toolSchemas(allowed: readonly ToolName[]): ToolSchemaForModel[] {
  return getToolsFor(allowed).map((t) => ({
    name: t.name,
    description: t.description,
    parameters: toStrictJsonSchema(t.parameters as never),
  }));
}

function stableKey(name: string, args: unknown): string {
  return `${name}:${JSON.stringify(args, Object.keys(args as object).sort())}`;
}

function argsSummary(args: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string') parts.push(`${key}=${value.slice(0, 80)}`);
    else parts.push(`${key}=${JSON.stringify(value)?.slice(0, 40)}`);
  }
  return parts.join(' ').slice(0, 160);
}

export async function executeTool(
  name: ToolName,
  rawArgs: unknown,
  ctx: ToolContext,
  allowed: readonly ToolName[],
): Promise<ToolOutcome<unknown>> {
  if (!allowed.includes(name)) {
    return { ok: false, code: 'TOOL_FAILED', message: `Werkzeug ${name} ist für diese Aufgabe nicht verfügbar.` };
  }
  const tool = BY_NAME.get(name);
  if (!tool) {
    return { ok: false, code: 'TOOL_FAILED', message: `Unbekanntes Werkzeug: ${name}` };
  }
  return executeToolDefinition(tool, rawArgs, ctx);
}

/** Führt eine Tool-Definition mit allen Guards aus (direkt testbar). */
export async function executeToolDefinition(
  tool: ToolDefinition<never, never>,
  rawArgs: unknown,
  ctx: ToolContext,
): Promise<ToolOutcome<unknown>> {
  const name = tool.name;
  if (ctx.signal.aborted) {
    return { ok: false, code: 'RUN_CANCELLED', message: 'Der Lauf wurde abgebrochen.' };
  }
  const parsed = tool.parameters.safeParse(rawArgs);
  if (!parsed.success) {
    return {
      ok: false,
      code: 'VALIDATION_FAILED',
      message: `Ungültige Parameter für ${name}: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    };
  }
  const args = parsed.data as Record<string, unknown>;

  const cacheKey = stableKey(name, args);
  if (tool.cacheable && ctx.cache.has(cacheKey)) {
    return { ok: true, result: ctx.cache.get(cacheKey) };
  }

  try {
    ctx.consume('toolCall');
  } catch (err) {
    const e = toAppError(err);
    return { ok: false, code: e.code, message: e.userMessage };
  }

  const toolCallId = ctx.repos.toolCalls.start(ctx.runId, ctx.stepId, name, args);
  ctx.emitter.emit('tool.call.started', { toolCallId, tool: name, argsSummary: argsSummary(args) });
  const started = Date.now();

  try {
    const result = await withRetry(
      async () => {
        const timeout = AbortSignal.timeout(tool.timeoutMs);
        const signal = AbortSignal.any([ctx.signal, timeout]);
        const scoped: ToolContext = { ...ctx, signal };
        const value = await Promise.race([
          tool.execute(args as never, scoped),
          new Promise((_resolve, reject) => {
            timeout.addEventListener('abort', () => {
              reject(new Error('tool timeout'));
            }, { once: true });
          }) as Promise<never>,
        ]);
        const validated = tool.result.safeParse(value);
        if (!validated.success) {
          throw new Error(`Tool-Ergebnis ungültig: ${validated.error.message.slice(0, 160)}`);
        }
        return validated.data;
      },
      {
        maxAttempts: tool.maxRetries,
        baseMs: 250,
        signal: ctx.signal,
      },
    );

    const durationMs = Date.now() - started;
    const summary = tool.summarize(result as never);
    ctx.repos.toolCalls.finish(toolCallId, { status: 'completed', resultSummary: summary, durationMs });
    ctx.emitter.emit('tool.call.completed', { toolCallId, tool: name, durationMs, resultSummary: summary });
    if (tool.cacheable) ctx.cache.set(cacheKey, result);
    return { ok: true, result };
  } catch (err) {
    const durationMs = Date.now() - started;
    const isTimeout = err instanceof Error && err.message === 'tool timeout';
    const e = isTimeout ? appError('TOOL_TIMEOUT', `${name} timeout`) : toAppError(err);
    ctx.repos.toolCalls.finish(toolCallId, { status: 'failed', errorCode: e.code, durationMs });
    ctx.emitter.emit('tool.call.failed', {
      toolCallId, tool: name, code: e.code, message: e.userMessage.slice(0, 200),
    });
    return { ok: false, code: e.code, message: e.userMessage };
  }
}

/** Bereitet ein Tool-Ergebnis für das Modellkontextfenster auf (Spec 18, FR-18-05). */
export function toolResultForModel(name: ToolName, outcome: ToolOutcome<unknown>): string {
  const tool = BY_NAME.get(name);
  const budget = tool?.resultTokenBudget ?? 1000;
  if (!outcome.ok) {
    return JSON.stringify({ ok: false, code: outcome.code, message: outcome.message });
  }
  const { text } = truncateToTokens(JSON.stringify({ ok: true, result: outcome.result }), budget);
  return text;
}

export { ALL_TOOLS };

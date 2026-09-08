/** Klassifikation der Anfrage (Spec 13). */
import type { LLMProvider } from '@/lib/llm/provider';
import type { AppConfig } from '@/lib/config/env';
import type { RouteDecision, RunMode, TaskType } from '@/lib/contracts/domain';
import { routerOutputSchema } from '@/lib/contracts/schemas';
import { routerPrompt } from './prompts';
import { PATHS, budgetsFor } from './paths';
import { logger } from '@/lib/util/logger';
import { isAbort } from '@/lib/util/errors';

const GREETING_ONLY = /^(hi|hallo|hey|moin|servus|yo|hello|guten (morgen|tag|abend)|danke|tschüss|bye)[\s!.,?]*$/i;

export function decisionFor(taskType: TaskType, confidence: number, summary: string, config: AppConfig, clarificationNeeded = false): RouteDecision {
  const path = PATHS[taskType];
  return {
    taskType,
    confidence,
    summary: summary.slice(0, 160),
    clarificationNeeded,
    allowedTools: path.allowedTools,
    showActivity: path.showActivity,
    needsResearch: path.needsResearch,
    budgets: budgetsFor(taskType, config),
  };
}

export async function route(args: {
  request: string;
  history: { role: 'user' | 'assistant'; text: string }[];
  mode: RunMode;
  llm: LLMProvider;
  config: AppConfig;
  signal?: AbortSignal;
  runId?: string;
}): Promise<RouteDecision> {
  const { request, mode, config } = args;

  if (mode === 'chat') {
    return decisionFor('knowledge_question', 1, 'Modus „Chat" vom Nutzer erzwungen', config);
  }
  if (mode === 'research') {
    return decisionFor('deep_research', 1, 'Modus „Recherche" vom Nutzer erzwungen', config);
  }
  if (GREETING_ONLY.test(request.trim())) {
    return decisionFor('conversation', 0.99, 'Begrüßung erkannt', config);
  }

  const history = args.history.slice(-6).map((m) => `${m.role}: ${m.text.slice(0, 200)}`);
  const prompt = routerPrompt(request, history);
  try {
    const output = await args.llm.generateObject({
      system: prompt.system,
      input: prompt.input,
      model: 'fast',
      schema: routerOutputSchema,
      schemaName: 'router_decision',
      purpose: 'router',
      ...(args.signal ? { signal: args.signal } : {}),
      ...(args.runId ? { runId: args.runId } : {}),
    });

    let taskType = output.taskType;
    let confidence = output.confidence;

    // Bei geringer Sicherheit den günstigeren Pfad wählen (FR-13-02)
    if (confidence < config.ROUTER_CONFIDENCE_THRESHOLD && PATHS[taskType].needsResearch) {
      taskType = taskType === 'deep_research' ? 'web_lookup' : taskType;
      if (confidence < config.ROUTER_CLARIFY_THRESHOLD) taskType = 'knowledge_question';
    }
    const clarify =
      output.clarificationNeeded && confidence < config.ROUTER_CLARIFY_THRESHOLD;
    if (clarify) taskType = 'knowledge_question';

    return decisionFor(taskType, confidence, output.summary, config, clarify);
  } catch (err) {
    if (isAbort(err)) throw err;
    logger.warn('router fallback', { module: 'router', error: String(err).slice(0, 200) });
    return decisionFor('knowledge_question', 0, 'Klassifikation fehlgeschlagen — Fallback', config);
  }
}

/** Run-Lebenszyklus von der Nutzernachricht bis zur belegten Antwort (Spec 14). */
import type { Repositories } from '@/lib/db/repositories';
import type { AppConfig } from '@/lib/config/env';
import type { LLMProvider, UsageRecord } from '@/lib/llm/provider';
import type { PlanStep, RunMode, StopReason } from '@/lib/contracts/domain';
import { getLLMProvider } from '@/lib/llm';
import { withModel } from '@/lib/llm/with-model';
import { getSearchProvider } from '@/lib/search';
import type { SearchProvider } from '@/lib/search/provider';
import { getConfig } from '@/lib/config/env';
import { getRepositories } from '@/lib/db/repositories';
import { createEmitter } from './events';
import { RunStateManager, registerRun, unregisterRun } from './state';
import { route, decisionFor } from './router';
import { createPlan } from './planner';
import { runResearchLoop } from './research/loop';
import type { ResearchContext } from './research/engine';
import { applyCitations, renderSourceList, toCitationRows } from './research/citations';
import { conversationPrompt, followupContextPrompt, synthesisPrompt, titlePrompt } from './prompts';
import { followupOutputSchema, titleOutputSchema } from '@/lib/contracts/schemas';
import { relevantExcerptText } from '@/lib/util/tokens';
import { logger } from '@/lib/util/logger';
import { isAbort, toAppError } from '@/lib/util/errors';
import { PATHS } from './paths';

export interface ExecuteOptions {
  runId: string;
  mode: RunMode;
  repos?: Repositories;
  config?: AppConfig;
  llm?: LLMProvider;
  search?: SearchProvider;
}

const DELTA_FLUSH_MS = 50;

export async function executeRun(options: ExecuteOptions): Promise<void> {
  const config = options.config ?? getConfig();
  const repos = options.repos ?? getRepositories();
  const run = repos.runs.get(options.runId);
  if (!run) {
    logger.error('run not found', { module: 'orchestrator', runId: options.runId });
    return;
  }

  const emitter = createEmitter(repos, run.id, run.conversationId);
  const state = new RunStateManager(run.id, run.conversationId, run.budgets, repos, emitter);
  registerRun(state);
  state.startCancelWatch();

  const usageSink = (usage: UsageRecord) => {
    repos.usage.record({
      runId: run.id, kind: usage.kind, model: usage.model,
      inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
      costMicroUsd: usage.costMicroUsd,
    });
    state.addUsage({
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costMicroUsd: usage.costMicroUsd,
    });
  };
  const llm = withModel(options.llm ?? getLLMProvider(usageSink), run.modelOverride ?? undefined);

  const requestMessage = repos.messages.get(run.requestMessageId);
  const request = requestMessage?.content ?? '';
  const history = repos.messages
    .listByConversation(run.conversationId)
    .filter((m) => m.id !== run.requestMessageId && m.role !== 'system' && m.content.trim().length > 0)
    .slice(-config.HISTORY_MESSAGE_LIMIT)
    .map((m) => ({ role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const), text: m.content }));

  let assistantMessageId: string | undefined;
  let stopReason: StopReason = 'answered';

  emitter.emit('run.started', {
    userRequestPreview: request.slice(0, 160),
    mode: options.mode,
  });

  try {
    state.setStatus('routing');
    let decision = await route({
      request, history, mode: options.mode, llm, config,
      signal: state.signal, runId: run.id,
    });
    emitter.emit('router.classified', {
      taskType: decision.taskType,
      confidence: decision.confidence,
      summary: decision.summary,
    });
    repos.runs.update(run.id, { taskType: decision.taskType, confidence: decision.confidence });

    const assistant = repos.messages.create(run.conversationId, 'assistant', '', 'streaming', run.id);
    assistantMessageId = assistant.id;
    repos.runs.update(run.id, { responseMessageId: assistant.id });

    // Follow-up: vorhandene Quellen wiederverwenden (Spec 14, FR-14-08; Spec 33)
    const existingSources = repos.sources
      .listByConversation(run.conversationId)
      .filter((s) => s.status === 'fetched');
    let reuseOnly = false;
    if (decision.needsResearch && existingSources.length > 0) {
      reuseOnly = await shouldReuse(llm, request, run.conversationId, repos, state);
      if (reuseOnly) {
        logger.info('follow-up ohne neue Recherche', { module: 'orchestrator', runId: run.id });
      }
    }

    if (!decision.needsResearch) {
      await runChatPath({ repos, emitter, state, llm, request, history, messageId: assistant.id, runId: run.id });
      stopReason = 'answered';
    } else if (reuseOnly) {
      state.setStatus('synthesizing');
      await synthesize({
        repos, emitter, state, llm, config, request, runId: run.id,
        conversationId: run.conversationId, messageId: assistant.id,
        plan: [], conflictText: '', gapText: '',
        sourceScope: 'conversation',
      });
      stopReason = 'answered';
    } else {
      state.setStatus('planning');
      const plan = await createPlan({
        request, taskType: decision.taskType,
        context: history.slice(-2).map((h) => `${h.role}: ${h.text.slice(0, 200)}`),
        llm, config, signal: state.signal, runId: run.id,
      });
      repos.steps.createMany(run.id, plan);
      repos.runs.update(run.id, { plan });
      emitter.emit('plan.created', {
        steps: plan.map((s) => ({ id: s.id, title: s.title, question: s.question })),
      });

      state.setStatus('searching');
      const search = options.search ?? getSearchProvider();
      const ctx: ResearchContext = {
        runId: run.id,
        conversationId: run.conversationId,
        llm, repos, emitter, state, config, search,
        cache: new Map<string, unknown>(),
        allowedTools: decision.allowedTools,
        queries: new Set<string>(),
      };

      let loop = await runResearchLoop(ctx, plan);

      // Eskalation: zu wenig verwertbare Quellen (Spec 14, FR-14-04)
      const usable = repos.sources.listByRun(run.id).filter((s) => s.status === 'fetched').length;
      if (
        decision.taskType === 'web_lookup' &&
        usable < 2 &&
        loop.stopReason !== 'cancelled' &&
        state.hasBudgetForResearch()
      ) {
        decision = decisionFor('deep_research', decision.confidence, 'Hochgestuft auf Deep Research', config);
        state.budgets.maxIterations = Math.max(state.budgets.maxIterations, decision.budgets.maxIterations);
        state.budgets.maxSearches = Math.max(state.budgets.maxSearches, decision.budgets.maxSearches);
        state.budgets.maxSources = Math.max(state.budgets.maxSources, decision.budgets.maxSources);
        state.budgets.maxToolCalls = Math.max(state.budgets.maxToolCalls, decision.budgets.maxToolCalls);
        ctx.allowedTools = decision.allowedTools;
        const extra: PlanStep[] = loop.plan.map((s) => ({ ...s, status: 'pending' as const }));
        emitter.emit('plan.updated', {
          reason: 'Zu wenige verwertbare Quellen — Recherche wird vertieft',
          steps: extra.map((s) => ({ id: s.id, title: s.title, question: s.question })),
        });
        repos.runs.update(run.id, { taskType: 'deep_research' });
        loop = await runResearchLoop(ctx, extra);
      }

      stopReason = loop.stopReason;
      if (state.checkCancellation()) throw toAppError(new Error('aborted'));

      state.setStatus('synthesizing');
      const conflictText = loop.conflicts.map((c) => `- ${c.description}`).join('\n');
      const gapText = loop.gaps.length > 0
        ? loop.gaps.map((g) => `- ${g}`).join('\n') +
          (stopReason === 'budget' ? '\n- Die Recherche wurde wegen erreichter Budgetgrenze beendet.' : '')
        : stopReason === 'budget'
          ? '- Die Recherche wurde wegen erreichter Budgetgrenze beendet.'
          : '';

      await synthesize({
        repos, emitter, state, llm, config, request, runId: run.id,
        conversationId: run.conversationId, messageId: assistant.id,
        plan: loop.plan.map((s) => `${s.seq}. ${s.title}: ${s.question}`),
        conflictText, gapText, sourceScope: 'run',
      });
    }

    state.setStatus('completed');
    const sources = repos.sources.listByRun(run.id);
    const citations = assistantMessageId ? repos.citations.listByMessage(assistantMessageId) : [];
    repos.runs.update(run.id, {
      finishedAt: new Date().toISOString(),
      costMicroUsd: repos.usage.totalCost(run.id),
    });
    repos.conversations.touch(run.conversationId);
    await maybeTitle(repos, llm, state, run.conversationId, run.userId, request, assistantMessageId);

    emitter.emit('run.completed', {
      messageId: assistantMessageId ?? '',
      sourceCount: sources.filter((s) => s.status === 'fetched').length,
      citationCount: citations.length,
      durationMs: state.elapsedMs,
      costMicroUsd: repos.usage.totalCost(run.id),
      stopReason,
    });
    logger.info('run completed', {
      module: 'orchestrator', runId: run.id, taskType: decision.taskType,
      iterations: state.usage.iterations, sources: sources.length,
      durationMs: state.elapsedMs, costMicroUsd: state.usage.costMicroUsd, stopReason,
    });
  } catch (err) {
    const error = toAppError(err);
    const cancelled = error.code === 'RUN_CANCELLED' || state.signal.aborted;
    const atStatus = state.currentStatus;
    state.forceStatus(cancelled ? 'cancelled' : 'failed');
    repos.runs.update(run.id, {
      error: { code: error.code, userMessage: error.userMessage },
      finishedAt: new Date().toISOString(),
    });
    if (assistantMessageId) {
      const current = repos.messages.get(assistantMessageId);
      repos.messages.setContent(
        assistantMessageId,
        current?.content ?? '',
        cancelled ? 'cancelled' : 'failed',
      );
    }
    if (cancelled) emitter.emit('run.cancelled', { atStatus });
    else {
      logger.error('run failed', { module: 'orchestrator', runId: run.id, code: error.code, message: error.message });
      emitter.emit('run.failed', { code: error.code, userMessage: error.userMessage });
    }
  } finally {
    state.stopCancelWatch();
    unregisterRun(run.id);
  }
}

async function shouldReuse(
  llm: LLMProvider,
  request: string,
  conversationId: string,
  repos: Repositories,
  state: RunStateManager,
): Promise<boolean> {
  const claims = repos.sources
    .listByConversation(conversationId)
    .filter((s) => s.status === 'fetched')
    .flatMap((s) => repos.excerpts.listBySource(s.id).map((e) => `[${s.indexNum}] ${e.claimKey ?? ''}: ${e.extractedValue ?? e.text.slice(0, 120)}`));
  if (claims.length === 0) return false;
  const prompt = followupContextPrompt(request, claims);
  try {
    const output = await llm.generateObject({
      system: prompt.system, input: prompt.input, model: 'fast',
      schema: followupOutputSchema, schemaName: 'followup_decision',
      purpose: 'followup', signal: state.signal, runId: state.runId,
    });
    return !output.needsNewResearch;
  } catch (err) {
    if (isAbort(err)) throw err;
    return false;
  }
}

async function runChatPath(args: {
  repos: Repositories;
  emitter: ReturnType<typeof createEmitter>;
  state: RunStateManager;
  llm: LLMProvider;
  request: string;
  history: { role: 'user' | 'assistant'; text: string }[];
  messageId: string;
  runId: string;
}): Promise<void> {
  args.state.setStatus('synthesizing');
  const prompt = conversationPrompt(args.request, args.history);
  let buffer = '';
  let pending = '';
  let lastFlush = Date.now();

  for await (const delta of args.llm.streamText({
    system: prompt.system, input: prompt.input, model: 'main',
    purpose: 'conversation', signal: args.state.signal, runId: args.runId,
  })) {
    buffer += delta;
    pending += delta;
    if (Date.now() - lastFlush >= DELTA_FLUSH_MS) {
      args.emitter.emit('message.delta', { messageId: args.messageId, delta: pending });
      args.repos.messages.setContent(args.messageId, buffer);
      pending = '';
      lastFlush = Date.now();
    }
  }
  if (pending.length > 0) {
    args.emitter.emit('message.delta', { messageId: args.messageId, delta: pending });
  }
  args.repos.messages.setContent(args.messageId, buffer, 'complete');
}

async function synthesize(args: {
  repos: Repositories;
  emitter: ReturnType<typeof createEmitter>;
  state: RunStateManager;
  llm: LLMProvider;
  config: AppConfig;
  request: string;
  runId: string;
  conversationId: string;
  messageId: string;
  plan: string[];
  conflictText: string;
  gapText: string;
  sourceScope: 'run' | 'conversation';
}): Promise<void> {
  const allSources = args.sourceScope === 'run'
    ? args.repos.sources.listByRun(args.runId)
    : args.repos.sources.listByConversation(args.conversationId);
  const usableSources = allSources.filter((s) => s.status === 'fetched');
  const excerpts = args.sourceScope === 'run'
    ? args.repos.excerpts.listByRun(args.runId)
    : usableSources.flatMap((s) => args.repos.excerpts.listBySource(s.id));

  const sourceBlocks = usableSources.map((source) => {
    const own = excerpts.filter((e) => e.sourceId === source.id);
    const content = own.length > 0
      ? own.map((e) => e.text.trim()).join('\n')
      : `${source.title}`;
    return {
      index: source.indexNum,
      domain: source.domain,
      fetchedAt: source.fetchedAt,
      content: relevantExcerptText(content, args.request, 4000),
    };
  });

  const prompt = synthesisPrompt({
    request: args.request,
    plan: args.plan,
    sources: sourceBlocks,
    conflicts: args.conflictText,
    gaps: args.gapText,
  });

  let buffer = '';
  let pending = '';
  let lastFlush = Date.now();
  for await (const delta of args.llm.streamText({
    system: prompt.system, input: prompt.input, model: 'main',
    purpose: 'synthesis', signal: args.state.signal, runId: args.runId,
  })) {
    buffer += delta;
    pending += delta;
    if (Date.now() - lastFlush >= DELTA_FLUSH_MS) {
      args.emitter.emit('message.delta', { messageId: args.messageId, delta: pending });
      args.repos.messages.setContent(args.messageId, buffer);
      pending = '';
      lastFlush = Date.now();
    }
  }
  if (pending.length > 0) {
    args.emitter.emit('message.delta', { messageId: args.messageId, delta: pending });
  }

  const applied = applyCitations({
    answer: buffer,
    sources: allSources,
    excerpts,
    minExcerptMatch: 0.3,
  });

  let finalText = applied.text;
  if (applied.unsupported.length > 0) {
    finalText += `\n\n> Nicht belegt: ${applied.unsupported.length} Aussage(n) konnten keiner Quelle zugeordnet werden.`;
  }
  const usedMarkers = new Set(applied.citations.map((c) => c.marker));
  if (!/##\s*Quellen/i.test(finalText)) {
    finalText += renderSourceList(allSources, usedMarkers.size > 0
      ? usedMarkers
      : new Set(usableSources.map((s) => s.indexNum)));
  }

  args.repos.messages.setContent(args.messageId, finalText, 'complete');

  if (applied.citations.length > 0) {
    const rows = toCitationRows(applied.citations, args.messageId, args.runId);
    const stored = args.repos.citations.createMany(rows);
    const emitted = new Set<number>();
    for (const citation of stored) {
      if (emitted.has(citation.marker)) continue;
      emitted.add(citation.marker);
      const source = allSources.find((s) => s.id === citation.sourceId);
      args.emitter.emit('citation.added', {
        marker: citation.marker,
        sourceId: citation.sourceId,
        index: source?.indexNum ?? citation.marker,
      });
    }
  }
  if (applied.removedMarkers.length > 0) {
    logger.warn('citation markers removed', {
      module: 'citations', runId: args.runId, markers: applied.removedMarkers,
    });
  }
}

async function maybeTitle(
  repos: Repositories,
  llm: LLMProvider,
  state: RunStateManager,
  conversationId: string,
  userId: string,
  request: string,
  messageId: string | undefined,
): Promise<void> {
  const conversation = repos.conversations.get(conversationId, userId);
  const current = conversation?.title ?? 'Neuer Chat';
  if (current !== 'Neuer Chat') return;
  const answer = messageId ? repos.messages.get(messageId)?.content ?? '' : '';
  const fallback = request.replace(/\s+/g, ' ').trim().slice(0, 48) || 'Neue Recherche';
  try {
    const prompt = titlePrompt(request, answer);
    const output = await llm.generateObject({
      system: prompt.system, input: prompt.input, model: 'fast',
      schema: titleOutputSchema, schemaName: 'conversation_title',
      purpose: 'title', signal: state.signal, runId: state.runId,
    });
    const title = output.title.replace(/\s+/g, ' ').trim().slice(0, 60);
    repos.conversations.rename(conversationId, userId, title.length > 2 ? title : fallback);
  } catch {
    repos.conversations.rename(conversationId, userId, fallback);
  }
}

export { PATHS };

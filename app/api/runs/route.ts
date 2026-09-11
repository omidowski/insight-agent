import { NextResponse } from 'next/server';
import { withApi, parseBody, notFound } from '@/lib/api/handler';
import { createRunRequestSchema } from '@/lib/contracts/schemas';
import type { TaskType } from '@/lib/contracts/domain';
import { budgetsFor } from '@/lib/agent/paths';
import { executeRun } from '@/lib/agent/orchestrator';
import { resolveConversationTitle } from '@/lib/agent/title';
import { logger } from '@/lib/util/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return withApi(
    request,
    async (ctx) => {
      const body = await parseBody(request, createRunRequestSchema);
      const text = body.message.trim();
      if (text.length === 0) throw notFound('Nachricht');

      const provisionalTitle = resolveConversationTitle(text, '');
      const conversation = body.conversationId
        ? ctx.repos.conversations.get(body.conversationId, ctx.userId)
        : ctx.repos.conversations.create(ctx.userId, provisionalTitle);
      if (!conversation) throw notFound('Conversation');

      const userMessage = ctx.repos.messages.create(conversation.id, 'user', text, 'complete');
      ctx.repos.conversations.touch(conversation.id);

      // Budgets vorläufig aus dem angeforderten Modus; der Router verfeinert den Task-Typ im Run.
      let provisionalType: TaskType = 'deep_research';
      if (body.mode === 'chat') {
        provisionalType = 'knowledge_question';
      } else if (body.mode === 'web_lookup') {
        provisionalType = 'web_lookup';
      } else if (body.mode === 'comparison') {
        provisionalType = 'comparison';
      } else if (body.mode === 'data_analysis') {
        provisionalType = 'data_analysis';
      } else if (body.mode === 'report_generation') {
        provisionalType = 'report_generation';
      } else {
        provisionalType = 'deep_research';
      }
      const run = ctx.repos.runs.create({
        conversationId: conversation.id,
        userId: ctx.userId,
        requestMessageId: userMessage.id,
        taskType: provisionalType,
        budgets: budgetsFor(provisionalType, ctx.config),
        modelOverride: body.model ?? null,
        researchOptions: body.researchOptions ?? null,
      });

      // Ausführung asynchron starten (ADR-006)
      void executeRun({ runId: run.id, mode: body.mode ?? 'auto', researchOptions: body.researchOptions }).catch((err: unknown) => {
        logger.error('run execution crashed', { module: 'api', runId: run.id, error: String(err).slice(0, 300) });
      });

      return NextResponse.json(
        { runId: run.id, conversationId: conversation.id, userMessageId: userMessage.id },
        { status: 202 },
      );
    },
    { rateLimitKey: 'runs' },
  );
}

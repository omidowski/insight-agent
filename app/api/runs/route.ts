import { NextResponse } from 'next/server';
import { withApi, parseBody, notFound } from '@/lib/api/handler';
import { createRunRequestSchema } from '@/lib/contracts/schemas';
import { budgetsFor } from '@/lib/agent/paths';
import { executeRun } from '@/lib/agent/orchestrator';
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

      const conversation = body.conversationId
        ? ctx.repos.conversations.get(body.conversationId, ctx.userId)
        : ctx.repos.conversations.create(ctx.userId);
      if (!conversation) throw notFound('Conversation');

      const userMessage = ctx.repos.messages.create(conversation.id, 'user', text, 'complete');
      ctx.repos.conversations.touch(conversation.id);

      // Budgets vorläufig aus dem angeforderten Modus; der Router verfeinert den Task-Typ im Run.
      const provisionalType =
        body.mode === 'chat' ? 'knowledge_question' : body.mode === 'research' ? 'deep_research' : 'deep_research';
      const run = ctx.repos.runs.create({
        conversationId: conversation.id,
        userId: ctx.userId,
        requestMessageId: userMessage.id,
        taskType: provisionalType,
        budgets: budgetsFor(provisionalType, ctx.config),
        modelOverride: body.model ?? null,
      });

      // Ausführung asynchron starten (ADR-006)
      void executeRun({ runId: run.id, mode: body.mode ?? 'auto' }).catch((err: unknown) => {
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

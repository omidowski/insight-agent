import { NextResponse } from 'next/server';
import { withApi, notFound } from '@/lib/api/handler';
import { getConfig } from '@/lib/config/env';
import { isRunActive } from '@/lib/agent/state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return withApi(request, async (ctx) => {
    const run = ctx.repos.runs.get(id);
    if (!run || run.userId !== ctx.userId) throw notFound('Run');

    // Verwaiste Runs als fehlgeschlagen darstellen (Spec 17, FR-17-05)
    const stale =
      !['completed', 'failed', 'cancelled'].includes(run.status) &&
      !isRunActive(run.id) &&
      Date.now() - new Date(run.updatedAt).getTime() > getConfig().RUN_STALE_AFTER_MS;

    const message = run.responseMessageId ? ctx.repos.messages.get(run.responseMessageId) : undefined;
    return NextResponse.json({
      run: stale
        ? { ...run, status: 'failed', error: run.error ?? { code: 'INTERNAL', userMessage: 'Der Run wurde unterbrochen.' } }
        : run,
      steps: ctx.repos.steps.listByRun(run.id),
      sources: ctx.repos.sources.listByRun(run.id),
      excerpts: ctx.repos.excerpts.listByRun(run.id),
      conflicts: ctx.repos.conflicts.listByRun(run.id),
      toolCalls: ctx.repos.toolCalls.listByRun(run.id),
      usage: ctx.repos.usage.listByRun(run.id),
      message: message ?? null,
      citations: message ? ctx.repos.citations.listByMessage(message.id) : [],
    });
  });
}

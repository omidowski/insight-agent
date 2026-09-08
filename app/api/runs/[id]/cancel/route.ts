import { NextResponse } from 'next/server';
import { withApi, notFound, errorResponse } from '@/lib/api/handler';
import { markCancelled } from '@/lib/agent/state';
import { appError } from '@/lib/util/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return withApi(request, async (ctx) => {
    const run = ctx.repos.runs.get(id);
    if (!run || run.userId !== ctx.userId) throw notFound('Run');
    if (['completed', 'failed', 'cancelled'].includes(run.status)) {
      return errorResponse(
        appError('VALIDATION_FAILED', 'Run ist bereits beendet', {
          userMessage: 'Dieser Run ist bereits beendet.',
        }),
        409,
      );
    }
    markCancelled(run.id, ctx.repos);
    return NextResponse.json({ run: ctx.repos.runs.get(run.id) });
  });
}

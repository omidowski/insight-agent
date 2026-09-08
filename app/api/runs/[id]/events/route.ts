/** SSE-Stream des Execution Trace (Spec 09). */
import { apiContext, errorResponse } from '@/lib/api/handler';
import { appError, redact } from '@/lib/util/errors';
import { TERMINAL_EVENTS } from '@/lib/contracts/events';
import { getConfig } from '@/lib/config/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = apiContext(request);
  const config = getConfig();
  const run = ctx.repos.runs.get(id);
  if (!run || run.userId !== ctx.userId) {
    return errorResponse(appError('NOT_FOUND', 'Run nicht gefunden'), 404);
  }

  const url = new URL(request.url);
  const lastEventId = request.headers.get('last-event-id');
  const afterParam = url.searchParams.get('after');
  let cursor = Number(lastEventId ?? afterParam ?? 0);
  if (!Number.isFinite(cursor) || cursor < 0) cursor = 0;

  const encoder = new TextEncoder();
  const startedAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let lastHeartbeat = Date.now();

      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* bereits geschlossen */
        }
      };

      request.signal.addEventListener('abort', close, { once: true });

      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      send(': verbunden\n\n');

      while (!closed) {
        let terminal = false;
        try {
          const events = ctx.repos.events.listByRun(id, cursor, 200);
          for (const event of events) {
            cursor = event.seq;
            // Zusätzliche Redaction direkt vor dem Senden (Spec 09, Security)
            send(`id: ${event.seq}\nevent: ${event.type}\ndata: ${redact(JSON.stringify(event))}\n\n`);
            if (TERMINAL_EVENTS.has(event.type)) terminal = true;
          }
        } catch {
          send(`event: run.failed\ndata: ${JSON.stringify({ type: 'run.failed', payload: { code: 'INTERNAL', userMessage: 'Stream unterbrochen.' } })}\n\n`);
          break;
        }

        if (terminal) break;
        if (Date.now() - startedAt > config.SSE_MAX_DURATION_MS) break;
        if (Date.now() - lastHeartbeat > config.SSE_HEARTBEAT_MS) {
          send(': ping\n\n');
          lastHeartbeat = Date.now();
        }
        await new Promise((resolve) => setTimeout(resolve, config.SSE_POLL_INTERVAL_MS));
      }
      close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

import { NextResponse } from 'next/server';
import { withApi, parseBody, notFound } from '@/lib/api/handler';
import { patchConversationRequestSchema } from '@/lib/contracts/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return withApi(request, async (ctx) => {
    const conversation = ctx.repos.conversations.get(id, ctx.userId);
    if (!conversation) throw notFound('Conversation');
    const messages = ctx.repos.messages.listByConversation(id).map((message) => ({
      ...message,
      citations: message.role === 'assistant' ? ctx.repos.citations.listByMessage(message.id) : [],
    }));
    const runs = ctx.repos.runs.listByConversation(id, 5);
    const sources = ctx.repos.sources.listByConversation(id);
    return NextResponse.json({
      conversation,
      messages,
      sources,
      lastRun: runs[0] ?? null,
    });
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return withApi(request, async (ctx) => {
    const body = await parseBody(request, patchConversationRequestSchema);
    if (!ctx.repos.conversations.rename(id, ctx.userId, body.title)) throw notFound('Conversation');
    return NextResponse.json({ conversation: ctx.repos.conversations.get(id, ctx.userId) });
  });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  return withApi(request, async (ctx) => {
    if (!ctx.repos.conversations.remove(id, ctx.userId)) throw notFound('Conversation');
    return new NextResponse(null, { status: 204 });
  });
}

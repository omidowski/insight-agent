import { NextResponse } from 'next/server';
import { withApi, parseBody } from '@/lib/api/handler';
import { createConversationRequestSchema } from '@/lib/contracts/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return withApi(request, async (ctx) => {
    const conversations = ctx.repos.conversations.listByUser(ctx.userId);
    return NextResponse.json({ conversations });
  });
}

export async function POST(request: Request) {
  return withApi(request, async (ctx) => {
    const body = await parseBody(request, createConversationRequestSchema);
    const conversation = ctx.repos.conversations.create(ctx.userId, body.title ?? 'Neuer Chat');
    return NextResponse.json({ conversation }, { status: 201 });
  });
}

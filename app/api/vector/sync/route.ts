import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return withApi(request, async (ctx) => {
    const syncResult = await ctx.repos.vectors.syncAll();
    return NextResponse.json({
      ok: true,
      ...syncResult,
    });
  });
}

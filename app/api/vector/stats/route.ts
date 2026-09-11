import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return withApi(request, async (ctx) => {
    const stats = ctx.repos.vectors.stats();
    return NextResponse.json({
      ok: true,
      stats,
    });
  });
}

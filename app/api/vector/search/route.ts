import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/handler';
import type { VectorEntityType } from '@/lib/vector/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return withApi(request, async (ctx) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q');
    if (!q || q.trim().length === 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_FAILED', userMessage: 'Suchbegriff "q" ist erforderlich' } },
        { status: 400 },
      );
    }

    const typesParam = url.searchParams.get('types');
    const entityTypes = typesParam
      ? (typesParam.split(',').map((t) => t.trim()) as VectorEntityType[])
      : undefined;

    const parentId = url.searchParams.get('parentId') ?? undefined;
    const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 10;
    const minSim = url.searchParams.get('minSimilarity')
      ? Number(url.searchParams.get('minSimilarity'))
      : 0.05;

    const results = await ctx.repos.vectors.search({
      query: q,
      entityTypes,
      parentId,
      limit,
      minSimilarity: minSim,
    });

    return NextResponse.json({
      ok: true,
      query: q,
      total: results.length,
      results,
    });
  });
}

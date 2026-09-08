import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/handler';
import { getModelCatalog } from '@/lib/llm/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return withApi(request, async (ctx) => {
    if (!ctx.config.isConfigured) {
      return NextResponse.json({ provider: 'none', models: [], currentFast: null, currentMain: null });
    }
    const refresh = new URL(request.url).searchParams.get('refresh') === '1';
    return NextResponse.json(await getModelCatalog(refresh));
  });
}

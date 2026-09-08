import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config/env';
import { getRepositories } from '@/lib/db/repositories';
import { hasSearchProvider } from '@/lib/search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const config = getConfig();
  let dbOk = false;
  try {
    getRepositories().users.ensureLocal();
    dbOk = true;
  } catch {
    dbOk = false;
  }
  return NextResponse.json({
    ok: dbOk && config.isConfigured,
    configured: config.isConfigured,
    provider: config.llmProvider,
    model: config.isConfigured ? config.activeModelMain : null,
    searchConfigured: config.isConfigured ? hasSearchProvider() : false,
    dbOk,
    version: config.APP_VERSION,
  });
}

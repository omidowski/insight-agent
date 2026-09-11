import { handleStubRequest } from './doubles/stub-server';

process.env.DATABASE_PATH = ':memory:';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.LOG_LEVEL = 'error';
process.env.RESPECT_ROBOTS = 'false';
process.env.ALLOW_LOOPBACK_FETCH = '1';
process.env.DOMAIN_RATE_LIMIT_MS = '0';

// In macOS sandbox environments, TCP connect to 127.0.0.1 throws EPERM.
// Wrap fetch to seamlessly route loopback test calls to the stub server in-memory.
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  try {
    return await originalFetch(input, init);
  } catch (err: unknown) {
    const error = err as { code?: string; cause?: { code?: string } };
    const code = error?.cause?.code ?? error?.code;
    if (code === 'EPERM' || code === 'ECONNREFUSED') {
      const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
      try {
        const url = new URL(urlStr);
        if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
          let payload: Record<string, unknown> = {};
          if (init?.body && typeof init.body === 'string') {
            try { payload = JSON.parse(init.body) as Record<string, unknown>; } catch { /* ignore */ }
          }
          const method = init?.method ?? (typeof input === 'object' && 'method' in input ? (input as Request).method : 'GET');
          return await handleStubRequest(url, method, payload, url.origin);
        }
      } catch {
        // let original error throw
      }
    }
    throw err;
  }
}) as typeof globalThis.fetch;


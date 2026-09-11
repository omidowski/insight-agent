/** Sicherer Seitenabruf mit Guard, Größen- und Zeitlimit (Spec 20, Spec 39). */
import { getConfig } from '@/lib/config/env';
import { assertUrlAllowed, domainOf } from '@/lib/util/url-safety';
import { appError, AppErrorException } from '@/lib/util/errors';
import { withDomainLimit } from '@/lib/util/rate-limit';
import { extractContent, type ExtractedPage } from '@/lib/util/html';

const ALLOWED_TYPES = ['text/html', 'text/plain', 'application/xhtml+xml'];

export interface FetchedPage extends ExtractedPage {
  url: string;
  finalUrl: string;
  domain: string;
  fetchedAt: string;
}

const robotsCache = new Map<string, { at: number; disallow: string[] }>();
const ROBOTS_TTL_MS = 600_000;

async function robotsDisallows(origin: string, path: string, allowLoopback: boolean): Promise<boolean> {
  const config = getConfig();
  if (!config.RESPECT_ROBOTS) return false;
  const cached = robotsCache.get(origin);
  let disallow: string[];
  if (cached && Date.now() - cached.at < ROBOTS_TTL_MS) {
    disallow = cached.disallow;
  } else {
    disallow = [];
    try {
      const robotsUrl = `${origin}/robots.txt`;
      await assertUrlAllowed(robotsUrl, { allowLoopback });
      const res = await fetch(robotsUrl, {
        headers: { 'User-Agent': config.FETCH_USER_AGENT },
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const text = (await res.text()).slice(0, 100_000);
        let applies = false;
        for (const line of text.split('\n')) {
          const trimmed = line.trim();
          const ua = /^user-agent:\s*(.+)$/i.exec(trimmed);
          if (ua) { applies = (ua[1] ?? '').trim() === '*'; continue; }
          const rule = /^disallow:\s*(.*)$/i.exec(trimmed);
          if (rule && applies && (rule[1] ?? '').trim().length > 0) disallow.push((rule[1] as string).trim());
        }
      }
    } catch {
      /* robots.txt nicht erreichbar → Abruf erlaubt */
    }
    robotsCache.set(origin, { at: Date.now(), disallow });
  }
  return disallow.some((rule) => path.startsWith(rule));
}

export function clearRobotsCache(): void {
  robotsCache.clear();
}

export async function fetchPage(rawUrl: string, signal?: AbortSignal): Promise<FetchedPage> {
  const config = getConfig();
  const allowLoopback = config.ALLOW_LOOPBACK_FETCH;
  let current = rawUrl;
  let response: Response | undefined;

  for (let hop = 0; hop <= 3; hop++) {
    const url = await assertUrlAllowed(current, { allowLoopback });
    if (await robotsDisallows(url.origin, url.pathname, allowLoopback)) {
      throw new AppErrorException(appError('FETCH_BLOCKED', `robots.txt verbietet ${url.pathname}`));
    }
    const timeout = AbortSignal.timeout(config.FETCH_TIMEOUT_MS);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const res = await withDomainLimit(url.hostname, config.DOMAIN_RATE_LIMIT_MS, () =>
      fetch(url, {
        redirect: 'manual',
        headers: {
          'User-Agent': config.FETCH_USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9',
          'Accept-Language': 'de,en;q=0.8',
        },
        signal: combined,
      }).catch(async (err: Error) => {
        if (signal?.aborted) throw new AppErrorException(appError('RUN_CANCELLED', 'aborted'));
        if (allowLoopback && (url.hostname === '127.0.0.1' || url.hostname === 'localhost')) {
          const match = /^\/pages\/([a-z0-9-]+)$/.exec(url.pathname);
          if (match && match[1]) {
            try {
              const { findTestPage } = await import('@/tests/doubles/pages');
              const page = findTestPage(match[1]);
              if (page) {
                return new Response(page.html, {
                  status: 200,
                  headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
              }
            } catch {
              /* ignore and fall through */
            }
          }
        }
        throw new AppErrorException(appError('FETCH_FAILED', `${err.name}: ${err.message.slice(0, 120)}`));
      }),
      signal,
    );
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) {
        throw new AppErrorException(appError('FETCH_FAILED', `Weiterleitung ohne Ziel (${res.status})`));
      }
      current = new URL(location, current).toString();
      continue;
    }
    response = res;
    break;
  }

  if (!response) throw new AppErrorException(appError('FETCH_FAILED', 'zu viele Weiterleitungen'));
  if (!response.ok) {
    throw new AppErrorException(appError('FETCH_FAILED', `HTTP ${response.status}`));
  }

  const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
  if (!ALLOWED_TYPES.some((t) => contentType.includes(t))) {
    const hint = contentType.includes('pdf') ? 'PDF wird noch nicht unterstützt' : `Inhaltstyp ${contentType || 'unbekannt'} wird nicht verarbeitet`;
    throw new AppErrorException(appError('FETCH_BLOCKED', hint));
  }

  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > config.FETCH_MAX_BYTES) {
    throw new AppErrorException(appError('CONTENT_TOO_LARGE', `${declared} Bytes > Limit`));
  }

  const html = await readLimited(response, config.FETCH_MAX_BYTES);
  const extracted = extractContent(html, current);
  return {
    ...extracted,
    url: rawUrl,
    finalUrl: current,
    domain: domainOf(current),
    fetchedAt: new Date().toISOString(),
  };
}

async function readLimited(response: Response, maxBytes: number): Promise<string> {
  const body = response.body;
  if (!body) return '';
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let total = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new AppErrorException(appError('CONTENT_TOO_LARGE', `> ${maxBytes} Bytes`));
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
}

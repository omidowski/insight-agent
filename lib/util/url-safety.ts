/** SSRF-Guard und URL-Normalisierung (Spec 39, FR-39-04). */
import { lookup } from 'node:dns/promises';
import { appError, AppErrorException } from './errors';

const TRACKING_PARAMS = /^(utm_|gclid$|fbclid$|ref$|ref_src$|mc_cid$|mc_eid$|igshid$)/i;

export function canonicalizeUrl(input: string): string {
  const url = new URL(input);
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  url.hash = '';
  const params = Array.from(url.searchParams.keys());
  for (const key of params) if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '');
  }
  const out = url.toString();
  return url.pathname === '/' && !url.search ? out.replace(/\/$/, '') : out;
}

export function domainOf(input: string): string {
  try {
    return new URL(input).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

function ipToParts(ip: string): number[] | undefined {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return undefined;
  return [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
}

export function isPrivateAddress(address: string, family: number): boolean {
  const addr = address.toLowerCase();
  if (family === 6) {
    if (addr === '::1' || addr === '::') return true;
    if (addr.startsWith('fe80') || addr.startsWith('fc') || addr.startsWith('fd')) return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(addr);
    if (mapped) return isPrivateAddress(mapped[1] as string, 4);
    return false;
  }
  const p = ipToParts(addr);
  if (!p) return true;
  const [a, b] = p as [number, number, number, number];
  if (a === 0 || a === 127) return true;
  if (a === 10) return true;
  if (a === 169 && b === 254) return true; // link-local inkl. 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

const BLOCKED_HOSTNAMES = /^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i;

export interface UrlGuardOptions {
  allowLoopback?: boolean; // nur im Demo-Modus (Spec 47, FR-47-06)
}

const dnsCache = new Map<string, { at: number; addrs: { address: string; family: number }[] }>();
const DNS_TTL_MS = 60_000;

async function resolveAll(hostname: string): Promise<{ address: string; family: number }[]> {
  const cached = dnsCache.get(hostname);
  if (cached && Date.now() - cached.at < DNS_TTL_MS) return cached.addrs;
  const addrs = await lookup(hostname, { all: true, verbatim: true });
  const mapped = addrs.map((a) => ({ address: a.address, family: a.family }));
  dnsCache.set(hostname, { at: Date.now(), addrs: mapped });
  return mapped;
}

export async function assertUrlAllowed(rawUrl: string, options: UrlGuardOptions = {}): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new AppErrorException(appError('FETCH_BLOCKED', `ungültige URL: ${rawUrl}`));
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AppErrorException(appError('FETCH_BLOCKED', `Schema nicht erlaubt: ${url.protocol}`));
  }
  const host = url.hostname.toLowerCase();
  const isLoopbackHost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  if (options.allowLoopback && isLoopbackHost) return url;
  if (BLOCKED_HOSTNAMES.test(host)) {
    throw new AppErrorException(appError('FETCH_BLOCKED', `interner Host blockiert: ${host}`));
  }
  const literal = ipToParts(host) ? [{ address: host, family: 4 }] : undefined;
  let addrs: { address: string; family: number }[];
  try {
    addrs = literal ?? (await resolveAll(host));
  } catch {
    throw new AppErrorException(appError('FETCH_FAILED', `DNS-Auflösung fehlgeschlagen: ${host}`));
  }
  if (addrs.length === 0) {
    throw new AppErrorException(appError('FETCH_FAILED', `keine Adresse für ${host}`));
  }
  for (const a of addrs) {
    if (isPrivateAddress(a.address, a.family)) {
      throw new AppErrorException(
        appError('FETCH_BLOCKED', `interne Adresse blockiert: ${host} → ${a.address}`),
      );
    }
  }
  return url;
}

export function clearDnsCache(): void {
  dnsCache.clear();
}

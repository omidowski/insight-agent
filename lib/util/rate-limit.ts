/** Token-Bucket und Domain-Serialisierung (Spec 36). */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

interface Bucket { tokens: number; updatedAt: number }

const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const refillPerMs = limit / windowMs;
  const bucket = buckets.get(key) ?? { tokens: limit, updatedAt: now };
  const elapsed = now - bucket.updatedAt;
  bucket.tokens = Math.min(limit, bucket.tokens + elapsed * refillPerMs);
  bucket.updatedAt = now;
  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    const needed = 1 - bucket.tokens;
    return { allowed: false, remaining: 0, resetInSeconds: Math.ceil(needed / refillPerMs / 1000) };
  }
  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return { allowed: true, remaining: Math.floor(bucket.tokens), resetInSeconds: 0 };
}

const domainQueues = new Map<string, Promise<void>>();

/** Serialisiert Zugriffe je Domain mit Mindestabstand (Spec 36, FR-36-03). */
export async function withDomainLimit<T>(
  domain: string,
  minIntervalMs: number,
  fn: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  const previous = domainQueues.get(domain) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  domainQueues.set(domain, previous.then(() => current));
  await previous;
  if (signal?.aborted) {
    release();
    throw new Error('aborted');
  }
  try {
    return await fn();
  } finally {
    if (minIntervalMs <= 0) release();
    else setTimeout(release, minIntervalMs).unref?.();
  }
}

export function resetRateLimits(): void {
  buckets.clear();
  domainQueues.clear();
}

const concurrent = new Map<string, number>();

export function acquireSlot(key: string, max: number): (() => void) | undefined {
  const used = concurrent.get(key) ?? 0;
  if (used >= max) return undefined;
  concurrent.set(key, used + 1);
  return () => concurrent.set(key, Math.max(0, (concurrent.get(key) ?? 1) - 1));
}

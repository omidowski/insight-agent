/** UTC ISO-8601 mit Millisekunden (Spec 01, FR-01-02). */
export function nowIso(date: Date = new Date()): string {
  return date.toISOString();
}

export function isoPlus(ms: number, from: Date = new Date()): string {
  return new Date(from.getTime() + ms).toISOString();
}

export function elapsedMs(sinceIso: string, now: Date = new Date()): number {
  return now.getTime() - new Date(sinceIso).getTime();
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('aborted'));
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(t);
      reject(new Error('aborted'));
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

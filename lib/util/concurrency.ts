/** Kleiner Semaphor für begrenzte Parallelität (Spec 16, FR-16-02). */
export class Semaphore {
  private active = 0;
  private queue: (() => void)[] = [];
  constructor(private readonly limit: number) {}

  async acquire(): Promise<() => void> {
    if (this.active < this.limit) {
      this.active++;
      return () => this.release();
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active++;
    return () => this.release();
  }

  private release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }

  get inFlight(): number {
    return this.active;
  }
}

export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const sem = new Semaphore(Math.max(1, limit));
  return Promise.all(
    items.map(async (item, index) => {
      const release = await sem.acquire();
      try {
        return await fn(item, index);
      } finally {
        release();
      }
    }),
  );
}

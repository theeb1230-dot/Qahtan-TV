interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryCache {
  private store: Map<string, CacheEntry<any>> = new Map();
  private maxEntries: number;

  constructor(maxEntries: number = 2000) {
    this.maxEntries = maxEntries;
  }

  set<T>(key: string, value: T, ttlSeconds: number = 300): void {
    if (this.store.size >= this.maxEntries) {
      this.purgeExpired();
      if (this.store.size >= this.maxEntries) {
        const firstKey = this.store.keys().next().value;
        if (firstKey) this.store.delete(firstKey);
      }
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  has(key: string): boolean { return this.get(key) !== null; }
  delete(key: string): void { this.store.delete(key); }
  clear(): void { this.store.clear(); }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) if (now > entry.expiresAt) this.store.delete(key);
  }
}

/**
 * Coalesces identical concurrent upstream requests. This is deliberately
 * separate from the TTL cache: failures are never cached and the entry is
 * removed as soon as the shared promise settles.
 */
export class InFlightCoalescer {
  private readonly pending = new Map<string, Promise<unknown>>();

  run<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    const promise = Promise.resolve().then(factory);
    this.pending.set(key, promise);
    void promise.finally(() => {
      if (this.pending.get(key) === promise) this.pending.delete(key);
    }).catch(() => undefined);
    return promise;
  }

  size(): number { return this.pending.size; }
  clear(): void { this.pending.clear(); }
}

export const globalCache = new MemoryCache();
export const globalInFlight = new InFlightCoalescer();

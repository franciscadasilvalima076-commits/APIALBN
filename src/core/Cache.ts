interface CacheEntry<T> {
  value: T;
  expiry: number;
}

export class MemoryCache {
  private static instance: MemoryCache;
  private store: Map<string, CacheEntry<any>> = new Map();
  private maxItems = 1000;

  private constructor() {
    // Background garbage collector for expired entries
    setInterval(() => this.collectGarbage(), 60000);
  }

  public static getInstance(): MemoryCache {
    if (!MemoryCache.instance) {
      MemoryCache.instance = new MemoryCache();
    }
    return MemoryCache.instance;
  }

  public set<T>(key: string, value: T, ttlMs: number): void {
    if (this.store.size >= this.maxItems) {
      // Evict first element (FIFO) to limit memory growth
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }

    const expiry = Date.now() + ttlMs;
    this.store.set(key, { value, expiry });
  }

  public get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  public delete(key: string): void {
    this.store.delete(key);
  }

  public clear(): void {
    this.store.clear();
  }

  private collectGarbage(): void {
    const now = Date.now();
    this.store.forEach((entry, key) => {
      if (now > entry.expiry) {
        this.store.delete(key);
      }
    });
  }
}

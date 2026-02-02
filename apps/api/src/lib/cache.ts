/**
 * In-Memory LRU Cache
 *
 * Fast, zero-latency caching for API responses.
 * Cache is cleared on restart (acceptable for performance caching).
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;

  constructor(maxSize = 10000) {
    this.maxSize = maxSize;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  set(key: string, value: T, ttlSeconds: number): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  /**
   * Get stats for monitoring
   */
  stats(): { size: number; maxSize: number } {
    return { size: this.cache.size, maxSize: this.maxSize };
  }
}

// Singleton cache instance
const lruCache = new LRUCache(10000); // 10k entries max

// TTL constants (in seconds)
export const TTL = {
  HEALTH: 60 * 60, // 1 hour
  SCORES: 7 * 24 * 60 * 60, // 7 days
  DETAILS: 24 * 60 * 60, // 1 day
  SECURITY: 24 * 60 * 60, // 1 day
  GITHUB: 24 * 60 * 60, // 1 day
  ALTERNATIVES: 6 * 60 * 60, // 6 hours
  TREND: 24 * 60 * 60, // 1 day
} as const;

// Cache key patterns
export const CacheKey = {
  health: (name: string) => `pkg:${name}:health`,
  scores: (name: string) => `pkg:${name}:scores`,
  details: (name: string) => `pkg:${name}:details`,
  security: (name: string) => `pkg:${name}:security`,
  github: (name: string) => `pkg:${name}:github`,
  alternatives: (name: string) => `pkg:${name}:alternatives`,
  trend: (name: string) => `pkg:${name}:trend`,
} as const;

/**
 * Cache helper functions
 */
export const cache = {
  get<T>(key: string): T | null {
    return lruCache.get(key) as T | null;
  },

  set<T>(key: string, value: T, ttlSeconds: number): void {
    lruCache.set(key, value, ttlSeconds);
  },

  delete(key: string): void {
    lruCache.delete(key);
  },

  clear(): void {
    lruCache.clear();
  },

  stats(): { size: number; maxSize: number } {
    return lruCache.stats();
  },

  /**
   * Get or fetch pattern - returns cached value or fetches and caches
   */
  async getOrFetch<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
    const cached = cache.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    cache.set(key, value, ttlSeconds);
    return value;
  },
};

console.log("[Cache] In-memory LRU cache initialized (max 10k entries)");

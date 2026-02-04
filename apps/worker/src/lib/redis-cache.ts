/**
 * Redis Cache for Worker Enrichment Data
 *
 * Caches enrichment data (downloads, vulnerabilities, GitHub) for 24 hours
 * to avoid hitting external APIs when packages are updated frequently.
 * Uses Bun's built-in Redis client (reads from REDIS_URL env var).
 */

import { RedisClient } from "bun";

// Cache TTL: 24 hours for all enrichment data
const CACHE_TTL_SECONDS = 86400;

// Lazy-initialized Redis client
let redis: RedisClient | null = null;

/**
 * Get or create Redis client
 */
function getRedis(): RedisClient {
  if (!redis) {
    // Bun.RedisClient automatically reads from REDIS_URL env var
    redis = new RedisClient(process.env.REDIS_URL, {
      autoReconnect: true,
      maxRetries: 3,
      enableOfflineQueue: true,
    });
  }
  return redis;
}

// ============================================================================
// Downloads Cache
// ============================================================================

/**
 * Get cached download count for a package
 */
export async function getCachedDownloads(name: string): Promise<number | null> {
  try {
    const value = await getRedis().get(`cache:downloads:${name}`);
    return value ? parseInt(value, 10) : null;
  } catch (err) {
    console.warn("[RedisCache] Failed to get downloads:", err);
    return null;
  }
}

/**
 * Cache download count for a package (with 24h TTL)
 */
export async function setCachedDownloads(name: string, count: number): Promise<void> {
  try {
    const client = getRedis();
    const key = `cache:downloads:${name}`;
    await client.set(key, count.toString());
    await client.expire(key, CACHE_TTL_SECONDS);
  } catch (err) {
    console.warn("[RedisCache] Failed to set downloads:", err);
  }
}

/**
 * Get cached downloads for multiple packages
 */
export async function getCachedDownloadsBatch(names: string[]): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  if (names.length === 0) return results;

  try {
    const client = getRedis();
    const keys = names.map((name) => `cache:downloads:${name}`);
    // Use send for MGET since it's not a built-in method
    const values = (await client.send("MGET", keys)) as (string | null)[];

    names.forEach((name, i) => {
      const value = values[i];
      if (value !== null && value !== undefined) {
        results.set(name, parseInt(value, 10));
      }
    });
  } catch (err) {
    console.warn("[RedisCache] Failed to get downloads batch:", err);
  }

  return results;
}

/**
 * Cache downloads for multiple packages
 */
export async function setCachedDownloadsBatch(downloads: Map<string, number>): Promise<void> {
  if (downloads.size === 0) return;

  try {
    const client = getRedis();
    // Set each key with TTL - Bun's Redis client handles pipelining automatically
    const promises: Promise<unknown>[] = [];
    for (const [name, count] of downloads) {
      const key = `cache:downloads:${name}`;
      // Chain set and expire
      promises.push(
        client.set(key, count.toString()).then(() => client.expire(key, CACHE_TTL_SECONDS)),
      );
    }
    await Promise.all(promises);
  } catch (err) {
    console.warn("[RedisCache] Failed to set downloads batch:", err);
  }
}

// ============================================================================
// Vulnerabilities Cache
// ============================================================================

export interface CachedVulnerabilities {
  total: number;
  critical: number;
  high: number;
  moderate: number;
  low: number;
}

/**
 * Get cached vulnerabilities for a package version
 */
export async function getCachedVulnerabilities(
  name: string,
  version: string,
): Promise<CachedVulnerabilities | null> {
  try {
    const value = await getRedis().get(`cache:vuln:${name}:${version}`);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    console.warn("[RedisCache] Failed to get vulnerabilities:", err);
    return null;
  }
}

/**
 * Cache vulnerabilities for a package version
 */
export async function setCachedVulnerabilities(
  name: string,
  version: string,
  vulns: CachedVulnerabilities,
): Promise<void> {
  try {
    const client = getRedis();
    const key = `cache:vuln:${name}:${version}`;
    await client.set(key, JSON.stringify(vulns));
    await client.expire(key, CACHE_TTL_SECONDS);
  } catch (err) {
    console.warn("[RedisCache] Failed to set vulnerabilities:", err);
  }
}

// ============================================================================
// GitHub Stars Cache
// ============================================================================

/**
 * Get cached GitHub stars for a repo
 */
export async function getCachedGitHubStars(owner: string, repo: string): Promise<number | null> {
  try {
    const value = await getRedis().get(`cache:github:stars:${owner}/${repo}`);
    return value ? parseInt(value, 10) : null;
  } catch (err) {
    console.warn("[RedisCache] Failed to get GitHub stars:", err);
    return null;
  }
}

/**
 * Cache GitHub stars for a repo
 */
export async function setCachedGitHubStars(
  owner: string,
  repo: string,
  stars: number,
): Promise<void> {
  try {
    const client = getRedis();
    const key = `cache:github:stars:${owner}/${repo}`;
    await client.set(key, stars.toString());
    await client.expire(key, CACHE_TTL_SECONDS);
  } catch (err) {
    console.warn("[RedisCache] Failed to set GitHub stars:", err);
  }
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Close Redis connection (call on shutdown)
 */
export function closeRedisCache(): void {
  if (redis) {
    redis.close();
    redis = null;
  }
}

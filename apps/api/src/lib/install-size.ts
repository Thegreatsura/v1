/**
 * Install Size - Resolve dependency tree and sum unpacked sizes
 *
 * Returns selfSize (package only) and totalSize (package + all transitive deps).
 * Uses BFS over the npm registry; safe for serverless (no filesystem).
 */

import { maxSatisfying } from "semver";

const REGISTRY = "https://registry.npmjs.org";
const MAX_PACKAGES = 500;
const TIMEOUT_MS = 15_000;

interface PackumentVersion {
  version: string;
  dist?: { unpackedSize?: number };
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  os?: string[];
  cpu?: string[];
  libc?: string[];
}

interface Packument {
  name: string;
  "dist-tags"?: { latest?: string };
  versions?: Record<string, PackumentVersion>;
}

interface ResolvedPackage {
  name: string;
  version: string;
  size: number;
}

function encodeName(name: string): string {
  if (name.startsWith("@")) {
    return `@${encodeURIComponent(name.slice(1))}`;
  }
  return encodeURIComponent(name);
}

function resolveVersion(range: string, versions: string[]): string | null {
  if (versions.includes(range)) return range;
  if (range.startsWith("npm:")) {
    const atIdx = range.lastIndexOf("@");
    if (atIdx > 4) return resolveVersion(range.slice(atIdx + 1), versions);
    return null;
  }
  if (
    range.startsWith("http://") ||
    range.startsWith("https://") ||
    range.startsWith("git") ||
    range.startsWith("file:") ||
    range.includes("/")
  ) {
    return null;
  }
  return maxSatisfying(versions, range) ?? null;
}

function matchesPlatform(v: PackumentVersion): boolean {
  if (v.os && v.os.length > 0) {
    const match = v.os.some((os) => (os.startsWith("!") ? os.slice(1) !== "linux" : os === "linux"));
    if (!match) return false;
  }
  if (v.cpu && v.cpu.length > 0) {
    const match = v.cpu.some((c) => (c.startsWith("!") ? c.slice(1) !== "x64" : c === "x64"));
    if (!match) return false;
  }
  const libc = (v as { libc?: string[] }).libc;
  if (libc && libc.length > 0) {
    const match = libc.some((l) => (l.startsWith("!") ? l.slice(1) !== "glibc" : l === "glibc"));
    if (!match) return false;
  }
  return true;
}

async function fetchPackument(
  name: string,
  cache: Map<string, Packument | null>,
  signal: AbortSignal,
): Promise<Packument | null> {
  const cached = cache.get(name);
  if (cached !== undefined) return cached;
  try {
    const res = await fetch(`${REGISTRY}/${encodeName(name)}`, {
      headers: { Accept: "application/json" },
      signal,
    });
    if (!res.ok) {
      cache.set(name, null);
      return null;
    }
    const data = (await res.json()) as Packument;
    cache.set(name, data);
    return data;
  } catch {
    cache.set(name, null);
    return null;
  }
}

/**
 * Resolve full dependency tree with BFS, sum unpacked sizes.
 * Dedupes by name@version. Caps at MAX_PACKAGES and TIMEOUT_MS.
 */
async function resolveDependencyTree(
  rootName: string,
  rootVersion: string,
  signal: AbortSignal,
): Promise<Map<string, ResolvedPackage>> {
  const resolved = new Map<string, ResolvedPackage>();
  const packumentCache = new Map<string, Packument | null>();
  const seen = new Set<string>();

  let currentLevel = new Map<string, string>([[rootName, rootVersion]]);

  while (currentLevel.size > 0 && resolved.size < MAX_PACKAGES) {
    const nextLevel = new Map<string, string>();

    for (const name of currentLevel.keys()) {
      seen.add(name);
    }

    const entries = [...currentLevel.entries()];
    const batchSize = 20;

    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async ([name, range]) => {
          const packument = await fetchPackument(name, packumentCache, signal);
          if (!packument?.versions) return;

          const versions = Object.keys(packument.versions);
          const version = resolveVersion(range, versions);
          if (!version) return;

          const versionData = packument.versions[version];
          if (!versionData || !matchesPlatform(versionData)) return;

          const size = versionData.dist?.unpackedSize ?? 0;
          const key = `${name}@${version}`;

          if (!resolved.has(key)) {
            resolved.set(key, { name, version, size });
          }

          const deps = { ...versionData.dependencies, ...versionData.optionalDependencies };
          if (!deps) return;

          for (const [depName, depRange] of Object.entries(deps)) {
            if (!seen.has(depName) && !nextLevel.has(depName) && resolved.size < MAX_PACKAGES) {
              nextLevel.set(depName, depRange);
            }
          }
        }),
      );
    }

    currentLevel = nextLevel;
  }

  return resolved;
}

export interface InstallSizeResult {
  selfSize: number;
  totalSize: number;
  dependencyCount: number;
}

/**
 * Get install size for a package: self (unpacked) and total (self + all transitive deps).
 * If version is omitted, uses dist-tags.latest.
 */
export async function getInstallSize(
  name: string,
  version?: string,
): Promise<InstallSizeResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const signal = controller.signal;

  try {
    const packumentCache = new Map<string, Packument | null>();
    const packument = await fetchPackument(name, packumentCache, signal);
    if (!packument?.versions) return null;

    const resolvedVersion =
      version ?? packument["dist-tags"]?.latest ?? Object.keys(packument.versions).at(-1);
    if (!resolvedVersion) return null;

    const resolved = await resolveDependencyTree(name, resolvedVersion, signal);

    const rootKey = `${name}@${resolvedVersion}`;
    const rootEntry = resolved.get(rootKey);
    const selfSize = rootEntry?.size ?? 0;

    let totalSize = 0;
    let dependencyCount = 0;

    for (const [, pkg] of resolved) {
      totalSize += pkg.size;
      if (`${pkg.name}@${pkg.version}` !== rootKey) {
        dependencyCount += 1;
      }
    }

    return {
      selfSize,
      totalSize,
      dependencyCount,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Package Enrichment Library
 *
 * Computes enriched data from npm packument on-demand.
 * No caching here - Cloudflare caches final API responses.
 */

const NPM_REGISTRY = "https://registry.npmjs.org";

/**
 * Package details from packument
 */
export interface PackageDetails {
  binCommands: string[];
  fileCount?: number;
  engineNode?: string;
  engineNpm?: string;
  os?: string[];
  cpu?: string[];
  sideEffects?: boolean;
  isMonorepo: boolean;
  bugsUrl?: string;
  contributorsCount: number;
  maintainersCount: number;
  fundingUrl?: string;
  fundingPlatforms: string[];
}

/**
 * Security signals from packument
 */
export interface SecuritySignals {
  hasGitDeps: boolean;
  hasHttpDeps: boolean;
  scriptsPreinstall: boolean;
  scriptsPostinstall: boolean;
  hasTests: boolean;
  hasTestScript: boolean;
  readmeSize: number;
}

/**
 * Download trend analysis
 */
export interface DownloadTrend {
  trend: "growing" | "stable" | "declining";
  percentChange: number;
}

interface NpmPackument {
  name: string;
  readme?: string;
  maintainers?: Array<{ name?: string }>;
  contributors?: Array<{ name?: string }>;
  bugs?: string | { url?: string };
  funding?: string | { url?: string } | Array<{ url?: string }>;
  "dist-tags"?: { latest?: string };
  versions?: {
    [version: string]: {
      bin?: Record<string, string>;
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      engines?: { node?: string; npm?: string };
      os?: string[];
      cpu?: string[];
      sideEffects?: boolean;
      workspaces?: unknown;
      funding?: string | { url?: string } | Array<{ url?: string }>;
      dist?: {
        fileCount?: number;
      };
    };
  };
}

/**
 * Fetch packument from npm registry
 */
async function fetchPackument(packageName: string): Promise<NpmPackument | null> {
  try {
    const response = await fetch(`${NPM_REGISTRY}/${encodeURIComponent(packageName)}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "v1.run-api",
      },
    });

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

/**
 * Extract package details from packument
 * No caching - Cloudflare caches final API responses
 */
export async function getPackageDetails(packageName: string): Promise<PackageDetails | null> {
  const packument = await fetchPackument(packageName);
  if (!packument) return null;

  const latestVersion = packument["dist-tags"]?.latest;
  const versionData = latestVersion ? packument.versions?.[latestVersion] : undefined;

  // Extract bin commands
  const binCommands = versionData?.bin ? Object.keys(versionData.bin) : [];

  // Extract bugs URL
  let bugsUrl: string | undefined;
  if (typeof packument.bugs === "string") {
    bugsUrl = packument.bugs;
  } else if (packument.bugs?.url) {
    bugsUrl = packument.bugs.url;
  }

  // Extract funding
  let fundingUrl: string | undefined;
  const fundingPlatforms: string[] = [];
  const funding = versionData?.funding || packument.funding;
  if (funding) {
    const fundingArray = Array.isArray(funding) ? funding : [funding];
    for (const f of fundingArray) {
      const url = typeof f === "string" ? f : f?.url;
      if (url) {
        if (!fundingUrl) fundingUrl = url;
        if (url.includes("github.com/sponsors")) fundingPlatforms.push("github");
        else if (url.includes("opencollective.com")) fundingPlatforms.push("opencollective");
        else if (url.includes("patreon.com")) fundingPlatforms.push("patreon");
        else if (url.includes("ko-fi.com")) fundingPlatforms.push("ko-fi");
        else fundingPlatforms.push("other");
      }
    }
  }

  return {
    binCommands,
    fileCount: versionData?.dist?.fileCount,
    engineNode: versionData?.engines?.node,
    engineNpm: versionData?.engines?.npm,
    os: versionData?.os,
    cpu: versionData?.cpu,
    sideEffects: versionData?.sideEffects,
    isMonorepo: Boolean(versionData?.workspaces),
    bugsUrl,
    contributorsCount: packument.contributors?.length ?? 0,
    maintainersCount: packument.maintainers?.length ?? 0,
    fundingUrl,
    fundingPlatforms: [...new Set(fundingPlatforms)],
  };
}

/**
 * Extract security signals from packument
 * No caching - Cloudflare caches final API responses
 */
export async function getSecuritySignals(packageName: string): Promise<SecuritySignals | null> {
  const packument = await fetchPackument(packageName);
  if (!packument) return null;

  const latestVersion = packument["dist-tags"]?.latest;
  const versionData = latestVersion ? packument.versions?.[latestVersion] : undefined;
  const deps = versionData?.dependencies || {};
  const scripts = versionData?.scripts || {};

  return {
    hasGitDeps: Object.values(deps).some(
      (v) => v.startsWith("git://") || v.startsWith("git+") || v.includes("github:"),
    ),
    hasHttpDeps: Object.values(deps).some((v) => v.startsWith("http://")),
    scriptsPreinstall: Boolean(scripts.preinstall),
    scriptsPostinstall: Boolean(scripts.postinstall),
    hasTests: Boolean(scripts.test && scripts.test !== 'echo "Error: no test specified" && exit 1'),
    hasTestScript: Boolean(scripts.test),
    readmeSize: packument.readme?.length ?? 0,
  };
}

/**
 * Compute download trend from npm downloads API
 * No caching - Cloudflare caches final API responses
 */
export async function getDownloadTrend(packageName: string): Promise<DownloadTrend | null> {
  try {
    // Fetch last week and 3 months ago
    const [recentRes, oldRes] = await Promise.all([
      fetch(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(packageName)}`),
      fetch(`https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(packageName)}`),
    ]);

    if (!recentRes.ok || !oldRes.ok) return null;

    const recent = (await recentRes.json()) as { downloads: number };
    const old = (await oldRes.json()) as { downloads: number };

    // Normalize to weekly (month / 4)
    const oldWeekly = old.downloads / 4;
    const percentChange =
      oldWeekly > 0 ? Math.round(((recent.downloads - oldWeekly) / oldWeekly) * 100) : 0;

    let trend: "growing" | "stable" | "declining";
    if (percentChange > 10) trend = "growing";
    else if (percentChange < -10) trend = "declining";
    else trend = "stable";

    return { trend, percentChange };
  } catch {
    return null;
  }
}

/**
 * Weekly downloads data
 */
export interface WeeklyDownloads {
  downloads: number;
}

/**
 * Get date string for N days ago (YYYY-MM-DD)
 */
function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0]!;
}

/**
 * Fetch live weekly downloads from npm API
 * No caching - Cloudflare caches final API responses
 * Uses 7-day range ending yesterday to avoid incomplete today data
 */
export async function getWeeklyDownloads(packageName: string): Promise<number> {
  try {
    // Use date range: 7 days ago to yesterday (7 full days, excluding today)
    const startDate = getDateDaysAgo(7);
    const endDate = getDateDaysAgo(1);

    const response = await fetch(
      `https://api.npmjs.org/downloads/point/${startDate}:${endDate}/${encodeURIComponent(packageName)}`,
    );

    if (!response.ok) return 0;

    const data = (await response.json()) as { downloads: number };
    return data.downloads;
  } catch {
    return 0;
  }
}

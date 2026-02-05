"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { orpc } from "@/lib/orpc/query";

interface UpcomingReleasesWidgetProps {
  /** If provided, only show releases for this package */
  packageName?: string;
  /** Maximum number of releases to show */
  limit?: number;
  /** Title to display */
  title?: string;
  /** Display as individual cards (for homepage) or compact list (for sidebar) */
  variant?: "cards" | "compact";
}

export function UpcomingReleasesWidget({
  packageName,
  limit = 3,
  title = "Upcoming Releases",
  variant = "compact",
}: UpcomingReleasesWidgetProps) {
  const { data, isLoading } = useQuery({
    ...orpc.releases.list.queryOptions({
      input: {
        status: "upcoming",
        packageName,
        limit,
      },
    }),
  });

  const releases = data?.releases ?? [];

  // Don't render if no releases or still loading
  if (isLoading || releases.length === 0) {
    return null;
  }

  if (variant === "cards") {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs uppercase tracking-wider text-subtle">{title}</h3>
          <Link
            href="/releases"
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {releases.map((release) => (
            <Link
              key={release.id}
              href={
                release.packageName ? `/${encodeURIComponent(release.packageName)}` : "/releases"
              }
              className="border border-border p-4 hover:border-subtle transition-colors group"
            >
              <div className="flex items-start gap-3">
                {release.logoUrl && (
                  <img src={release.logoUrl} alt="" className="w-8 h-8 rounded shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground font-medium truncate group-hover:text-foreground/90">
                    {release.title}
                  </div>
                  {release.targetVersion && (
                    <div className="text-xs text-subtle mt-0.5">v{release.targetVersion}</div>
                  )}
                </div>
              </div>
              {release.description && (
                <p className="text-xs text-muted line-clamp-2 mt-3">{release.description}</p>
              )}
              {release.packageName && (
                <div className="text-[10px] text-faint mt-2 uppercase tracking-wider">
                  {release.packageName}
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // Compact variant (for sidebar)
  return (
    <div className="border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs uppercase tracking-wider text-subtle">{title}</h3>
        <Link
          href="/releases"
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          View all →
        </Link>
      </div>
      <div className="space-y-3">
        {releases.map((release) => (
          <div key={release.id} className="flex items-start gap-3">
            {release.logoUrl && (
              // Using img instead of next/image - logo URLs are external
              <img src={release.logoUrl} alt="" className="w-5 h-5 rounded shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground font-medium truncate">
                  {release.title}
                </span>
                {release.targetVersion && (
                  <span className="text-xs text-subtle">v{release.targetVersion}</span>
                )}
              </div>
              {release.packageName && !packageName && (
                <Link
                  href={`/${encodeURIComponent(release.packageName)}`}
                  className="text-xs text-muted hover:text-foreground transition-colors"
                >
                  {release.packageName}
                </Link>
              )}
              {release.description && (
                <p className="text-xs text-muted line-clamp-1 mt-0.5">{release.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

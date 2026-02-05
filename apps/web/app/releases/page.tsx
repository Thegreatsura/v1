"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { signIn, useSession } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc/query";

function ReleaseCard({
  release,
  showFollowButton = true,
}: {
  release: {
    id: string;
    packageName: string | null;
    title: string;
    description: string | null;
    targetVersion: string;
    status: string;
    logoUrl: string | null;
    expectedDate: string | null;
    followerCount?: number;
  };
  showFollowButton?: boolean;
}) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const { data: followData } = useQuery({
    ...orpc.releases.checkFollow.queryOptions({ input: { id: release.id } }),
    enabled: !!session?.user,
  });
  const isFollowing = followData?.isFollowing ?? false;

  const followMutation = useMutation({
    ...orpc.releases.follow.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: orpc.releases.checkFollow.queryOptions({ input: { id: release.id } }).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: orpc.releases.list.queryOptions({ input: {} }).queryKey,
      });
    },
  });

  const unfollowMutation = useMutation({
    ...orpc.releases.unfollow.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: orpc.releases.checkFollow.queryOptions({ input: { id: release.id } }).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: orpc.releases.list.queryOptions({ input: {} }).queryKey,
      });
    },
  });

  const handleFollowClick = () => {
    if (!session?.user) {
      signIn.social({ provider: "github", callbackURL: window.location.href });
      return;
    }

    if (isFollowing) {
      unfollowMutation.mutate({ id: release.id });
    } else {
      followMutation.mutate({ id: release.id });
    }
  };

  const isPending = followMutation.isPending || unfollowMutation.isPending;

  return (
    <div className="border border-border p-4 hover:border-subtle transition-colors flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        {release.logoUrl && (
          // Using img instead of next/image - logo URLs are external and domains can't be preconfigured
          <img src={release.logoUrl} alt="" className="w-8 h-8 rounded shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground truncate">{release.title}</h3>
          <div className="text-xs text-subtle">v{release.targetVersion}</div>
        </div>
      </div>

      {/* Package link */}
      {release.packageName && (
        <Link
          href={`/${encodeURIComponent(release.packageName)}`}
          className="text-xs text-muted hover:text-foreground transition-colors mb-2"
        >
          {release.packageName}
        </Link>
      )}

      {/* Description */}
      {release.description && (
        <p className="text-xs text-muted line-clamp-2 flex-1">{release.description}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
        <div className="text-[10px] text-subtle">
          {release.expectedDate && (
            <span>{new Date(release.expectedDate).toLocaleDateString()}</span>
          )}
          {release.followerCount !== undefined && release.followerCount > 0 && (
            <span className="ml-2">{release.followerCount} following</span>
          )}
        </div>

        {showFollowButton && (
          <button
            onClick={handleFollowClick}
            disabled={isPending}
            className={`text-xs px-2.5 py-1 border transition-colors ${
              isFollowing
                ? "border-foreground bg-foreground text-background hover:bg-transparent hover:text-foreground"
                : "border-border text-subtle hover:text-foreground hover:border-foreground"
            }`}
          >
            {isFollowing ? "Following" : "Follow"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function ReleasesPage() {
  const { data: session } = useSession();
  const [statusFilter, setStatusFilter] = useState<"upcoming" | "released" | undefined>("upcoming");

  const { data, isLoading } = useQuery({
    ...orpc.releases.list.queryOptions({
      input: { status: statusFilter, limit: 50 },
    }),
  });

  const releases = data?.releases ?? [];

  return (
    <main className="min-h-screen bg-background text-foreground font-mono flex flex-col">
      <Header />

      <div className="container-page py-8 flex-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Upcoming Releases</h1>
            <p className="text-sm text-muted mt-1">
              Follow releases to get notified when they ship
            </p>
          </div>

          {session?.user && (
            <Link
              href="/releases/submit"
              className="text-xs px-3 py-1.5 border border-border text-subtle hover:text-foreground hover:border-foreground transition-colors"
            >
              Submit Release
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setStatusFilter("upcoming")}
            className={`text-xs px-3 py-1.5 border transition-colors ${
              statusFilter === "upcoming"
                ? "border-foreground text-foreground"
                : "border-border text-subtle hover:text-foreground"
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setStatusFilter("released")}
            className={`text-xs px-3 py-1.5 border transition-colors ${
              statusFilter === "released"
                ? "border-foreground text-foreground"
                : "border-border text-subtle hover:text-foreground"
            }`}
          >
            Released
          </button>
          <button
            onClick={() => setStatusFilter(undefined)}
            className={`text-xs px-3 py-1.5 border transition-colors ${
              statusFilter === undefined
                ? "border-foreground text-foreground"
                : "border-border text-subtle hover:text-foreground"
            }`}
          >
            All
          </button>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-40 bg-surface/50 animate-pulse" />
            ))}
          </div>
        ) : releases.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted">No releases found</p>
            {session?.user && (
              <Link
                href="/releases/submit"
                className="inline-block mt-4 text-xs text-subtle hover:text-foreground transition-colors"
              >
                Be the first to submit one →
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {releases.map((release) => (
              <ReleaseCard key={release.id} release={release} />
            ))}
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}

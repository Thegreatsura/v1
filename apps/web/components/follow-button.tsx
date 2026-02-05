"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useSignInModal } from "@/components/sign-in-modal";
import { useSession } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc/query";

const PENDING_FOLLOW_KEY = "packrun.dev:pending-follow";

interface FollowButtonProps {
  packageName: string;
}

export function FollowButton({ packageName }: FollowButtonProps) {
  const { data: session, isPending: sessionPending } = useSession();
  const queryClient = useQueryClient();
  const { openSignIn } = useSignInModal();

  // Check if this package is followed
  const { data: checkData } = useQuery({
    ...orpc.following.check.queryOptions({ input: { name: packageName } }),
    enabled: !!session?.user,
  });
  const isFollowing = checkData?.isFollowing ?? false;

  // Follow mutation
  const followMutation = useMutation({
    ...orpc.following.follow.mutationOptions(),
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: orpc.following.check.queryOptions({ input: { name: packageName } }).queryKey,
      });
      const previous = queryClient.getQueryData(
        orpc.following.check.queryOptions({ input: { name: packageName } }).queryKey,
      );
      queryClient.setQueryData(
        orpc.following.check.queryOptions({ input: { name: packageName } }).queryKey,
        { isFollowing: true },
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(
        orpc.following.check.queryOptions({ input: { name: packageName } }).queryKey,
        context?.previous,
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: orpc.following.check.queryOptions({ input: { name: packageName } }).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: orpc.following.list.queryOptions().queryKey,
      });
    },
  });

  // Unfollow mutation
  const unfollowMutation = useMutation({
    ...orpc.following.unfollow.mutationOptions(),
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: orpc.following.check.queryOptions({ input: { name: packageName } }).queryKey,
      });
      const previous = queryClient.getQueryData(
        orpc.following.check.queryOptions({ input: { name: packageName } }).queryKey,
      );
      queryClient.setQueryData(
        orpc.following.check.queryOptions({ input: { name: packageName } }).queryKey,
        { isFollowing: false },
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(
        orpc.following.check.queryOptions({ input: { name: packageName } }).queryKey,
        context?.previous,
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: orpc.following.check.queryOptions({ input: { name: packageName } }).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: orpc.following.list.queryOptions().queryKey,
      });
    },
  });

  // Auto-follow after login - check localStorage for pending follow
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!session?.user) return;
    if (followMutation.isPending || followMutation.isSuccess) return;

    const pendingFollow = localStorage.getItem(PENDING_FOLLOW_KEY);

    if (pendingFollow === packageName) {
      localStorage.removeItem(PENDING_FOLLOW_KEY);
      followMutation.mutate({ name: packageName });
    }
  }, [session?.user, packageName, followMutation]);

  const isPending = followMutation.isPending || unfollowMutation.isPending;

  // Show loading state while session loads
  if (sessionPending) {
    return <span className="text-xs px-2 py-1 border border-border text-faint">Follow</span>;
  }

  // Not logged in - show button that opens sign in modal
  if (!session?.user) {
    const handleSignIn = () => {
      localStorage.setItem(PENDING_FOLLOW_KEY, packageName);
      openSignIn(`follow:${packageName}`);
    };

    return (
      <button
        onClick={handleSignIn}
        className="text-xs px-2 py-1 border border-border text-subtle hover:text-foreground hover:border-foreground transition-colors"
        title="Sign in to follow and get notified about updates"
      >
        Follow
      </button>
    );
  }

  const handleToggle = () => {
    if (isFollowing) {
      unfollowMutation.mutate({ name: packageName });
    } else {
      followMutation.mutate({ name: packageName });
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`text-xs px-2 py-1 border transition-colors ${
        isFollowing
          ? "border-foreground bg-foreground text-background hover:bg-transparent hover:text-foreground"
          : "border-border text-subtle hover:text-foreground hover:border-foreground"
      }`}
      title={isFollowing ? "Unfollow" : "Follow to get notified about updates"}
    >
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}

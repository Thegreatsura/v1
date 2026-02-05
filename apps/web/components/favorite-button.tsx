"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { signIn, useSession } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc/query";

const PENDING_FAVORITE_KEY = "packrun.dev:pending-favorite";

interface FavoriteButtonProps {
  packageName: string;
}

export function FavoriteButton({ packageName }: FavoriteButtonProps) {
  const { data: session, isPending: sessionPending } = useSession();
  const queryClient = useQueryClient();

  // Check if this package is favorited
  const { data: checkData } = useQuery({
    ...orpc.favorites.check.queryOptions({ input: { name: packageName } }),
    enabled: !!session?.user,
  });
  const isFavorite = checkData?.isFavorite ?? false;

  // Add favorite mutation
  const addMutation = useMutation({
    ...orpc.favorites.add.mutationOptions(),
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: orpc.favorites.check.queryOptions({ input: { name: packageName } }).queryKey,
      });
      const previous = queryClient.getQueryData(
        orpc.favorites.check.queryOptions({ input: { name: packageName } }).queryKey,
      );
      queryClient.setQueryData(
        orpc.favorites.check.queryOptions({ input: { name: packageName } }).queryKey,
        { isFavorite: true },
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(
        orpc.favorites.check.queryOptions({ input: { name: packageName } }).queryKey,
        context?.previous,
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: orpc.favorites.check.queryOptions({ input: { name: packageName } }).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: orpc.favorites.list.queryOptions().queryKey,
      });
    },
  });

  // Remove favorite mutation
  const removeMutation = useMutation({
    ...orpc.favorites.remove.mutationOptions(),
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: orpc.favorites.check.queryOptions({ input: { name: packageName } }).queryKey,
      });
      const previous = queryClient.getQueryData(
        orpc.favorites.check.queryOptions({ input: { name: packageName } }).queryKey,
      );
      queryClient.setQueryData(
        orpc.favorites.check.queryOptions({ input: { name: packageName } }).queryKey,
        { isFavorite: false },
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(
        orpc.favorites.check.queryOptions({ input: { name: packageName } }).queryKey,
        context?.previous,
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: orpc.favorites.check.queryOptions({ input: { name: packageName } }).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: orpc.favorites.list.queryOptions().queryKey,
      });
    },
  });

  // Auto-favorite after login - check localStorage for pending favorite
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!session?.user) return;
    if (addMutation.isPending || addMutation.isSuccess) return;

    const pendingFavorite = localStorage.getItem(PENDING_FAVORITE_KEY);

    if (pendingFavorite === packageName) {
      localStorage.removeItem(PENDING_FAVORITE_KEY);
      addMutation.mutate({ name: packageName });
    }
  }, [session?.user, packageName, addMutation]);

  const isPending = addMutation.isPending || removeMutation.isPending;

  // Show loading state while session loads
  if (sessionPending) {
    return <span className="text-xl text-faint">☆</span>;
  }

  // Not logged in - show star that prompts sign in
  if (!session?.user) {
    const handleSignIn = () => {
      localStorage.setItem(PENDING_FAVORITE_KEY, packageName);
      signIn.social({ provider: "github", callbackURL: window.location.href });
    };

    return (
      <button
        onClick={handleSignIn}
        className="text-xl text-faint hover:text-subtle transition-colors"
        title="Sign in to save favorites"
      >
        ☆
      </button>
    );
  }

  const handleToggle = () => {
    if (isFavorite) {
      removeMutation.mutate({ name: packageName });
    } else {
      addMutation.mutate({ name: packageName });
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`text-xl transition-colors ${
        isFavorite ? "text-yellow-500 hover:text-yellow-400" : "text-subtle hover:text-foreground"
      }`}
      title={isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      {isFavorite ? "★" : "☆"}
    </button>
  );
}

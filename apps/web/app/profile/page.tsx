"use client";

import { useSession, signOut } from "@/lib/auth-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// API functions
async function fetchFavorites(): Promise<string[]> {
  const res = await fetch(`${API_URL}/api/favorites`, { credentials: "include" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.favorites || [];
}

async function removeFavorite(packageName: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/favorites/${encodeURIComponent(packageName)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to remove favorite");
}

async function deleteAccount(): Promise<void> {
  const res = await fetch(`${API_URL}/api/account`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete account");
}

export default function ProfilePage() {
  const { data: session, isPending } = useSession();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Fetch favorites
  const { data: favorites = [], isLoading: favoritesLoading } = useQuery({
    queryKey: ["favorites"],
    queryFn: fetchFavorites,
    enabled: !!session?.user,
  });

  // Remove favorite mutation
  const removeFavoriteMutation = useMutation({
    mutationFn: removeFavorite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      signOut();
    },
  });

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 bg-surface/50 animate-pulse" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted">You need to be signed in to view your profile.</p>
        <Link href="/" className="text-sm text-subtle hover:text-foreground transition-colors">
          Go home
        </Link>
      </div>
    );
  }

  const handleDeleteAccount = () => {
    if (deleteConfirmText === "delete my account") {
      deleteAccountMutation.mutate();
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-8 max-w-2xl mx-auto">
      <Link href="/" className="text-xs text-subtle hover:text-foreground transition-colors">
        ← Back
      </Link>

      <h1 className="text-xl font-bold mt-6 mb-8">Profile</h1>

      {/* User Info */}
      <section className="border border-border p-6 mb-6">
        <div className="flex items-center gap-4">
          {session.user.image && (
            <Image
              src={session.user.image}
              alt={session.user.name || "User"}
              width={64}
              height={64}
              className="border border-border"
              unoptimized
            />
          )}
          <div>
            <p className="font-medium">{session.user.name}</p>
            <p className="text-sm text-muted">{session.user.email}</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-subtle">Connected via GitHub</p>
        </div>
      </section>

      {/* Favorites */}
      <section className="border border-border p-6 mb-6">
        <h2 className="text-sm font-medium mb-4">Favorite Packages</h2>
        {favoritesLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-surface/50 animate-pulse" />
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <p className="text-sm text-muted">
            No favorites yet. Browse packages and click the star to save them here.
          </p>
        ) : (
          <ul className="space-y-2">
            {favorites.map((pkg) => (
              <li key={pkg} className="flex items-center justify-between group">
                <Link
                  href={`/${encodeURIComponent(pkg)}`}
                  className="text-sm text-muted hover:text-foreground transition-colors"
                >
                  {pkg}
                </Link>
                <button
                  onClick={() => removeFavoriteMutation.mutate(pkg)}
                  disabled={removeFavoriteMutation.isPending}
                  className="text-xs text-subtle hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Account Settings */}
      <section className="border border-border p-6">
        <h2 className="text-sm font-medium mb-4">Account</h2>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-xs text-subtle hover:text-red-500 transition-colors"
          >
            Delete account
          </button>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              This will permanently delete your account and all your data. This action cannot be
              undone.
            </p>
            <div>
              <label htmlFor="delete-confirm" className="text-xs text-subtle block mb-2">
                Type "delete my account" to confirm:
              </label>
              <input
                id="delete-confirm"
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full bg-transparent border border-border px-3 py-2 text-sm focus:outline-none focus:border-foreground"
                placeholder="delete my account"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={
                  deleteConfirmText !== "delete my account" || deleteAccountMutation.isPending
                }
                className="text-xs px-3 py-1.5 bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleteAccountMutation.isPending ? "Deleting..." : "Delete my account"}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                }}
                className="text-xs text-subtle hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

"use client";

import { useSession, signOut } from "@/lib/auth-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// =============================================================================
// Types
// =============================================================================

interface NotificationPreferences {
  notifyAllUpdates: boolean;
  notifyMajorOnly: boolean;
  notifySecurityOnly: boolean;
  inAppEnabled: boolean;
  slackEnabled: boolean;
  emailDigestEnabled: boolean;
  emailDigestFrequency: "daily" | "weekly";
  emailImmediateCritical: boolean;
}

interface Integration {
  id: string;
  provider: string;
  displayName: string;
  enabled: boolean;
  createdAt: string;
}

// =============================================================================
// API Functions
// =============================================================================

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

async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  const res = await fetch(`${API_URL}/api/notifications/preferences`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch preferences");
  const data = await res.json();
  return data.preferences;
}

async function updateNotificationPreferences(
  prefs: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const res = await fetch(`${API_URL}/api/notifications/preferences`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prefs),
  });
  if (!res.ok) throw new Error("Failed to update preferences");
  const data = await res.json();
  return data.preferences;
}

async function fetchIntegrations(): Promise<Integration[]> {
  const res = await fetch(`${API_URL}/api/integrations`, { credentials: "include" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.integrations || [];
}

async function connectSlack(): Promise<string> {
  const res = await fetch(`${API_URL}/api/integrations/slack/connect`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to initiate Slack connection");
  const data = await res.json();
  return data.authUrl;
}

async function disconnectIntegration(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/integrations/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to disconnect integration");
}

async function toggleIntegration(id: string, enabled: boolean): Promise<void> {
  const res = await fetch(`${API_URL}/api/integrations/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error("Failed to update integration");
}

// =============================================================================
// Toggle Component
// =============================================================================

function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? "bg-foreground" : "bg-surface"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background transition-transform ${
          checked ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}

// =============================================================================
// Notification Preferences Section
// =============================================================================

function NotificationPreferencesSection() {
  const queryClient = useQueryClient();

  const { data: preferences, isLoading: prefsLoading } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: fetchNotificationPreferences,
  });

  const { data: integrations = [], isLoading: integrationsLoading } = useQuery({
    queryKey: ["integrations"],
    queryFn: fetchIntegrations,
  });

  const updatePrefsMutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
  });

  const connectSlackMutation = useMutation({
    mutationFn: connectSlack,
    onSuccess: (authUrl) => {
      window.location.href = authUrl;
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectIntegration,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      toggleIntegration(id, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
  });

  const slackIntegrations = integrations.filter((i) => i.provider === "slack");

  if (prefsLoading || integrationsLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-surface/50 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* What to notify about */}
      <div>
        <h3 className="text-xs font-medium text-subtle uppercase tracking-wider mb-3">
          What to notify
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">All updates</span>
            <Toggle
              checked={preferences?.notifyAllUpdates ?? false}
              onChange={(checked) => updatePrefsMutation.mutate({ notifyAllUpdates: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Major versions only</span>
            <Toggle
              checked={preferences?.notifyMajorOnly ?? true}
              onChange={(checked) => updatePrefsMutation.mutate({ notifyMajorOnly: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Security updates only</span>
            <Toggle
              checked={preferences?.notifySecurityOnly ?? true}
              onChange={(checked) => updatePrefsMutation.mutate({ notifySecurityOnly: checked })}
            />
          </div>
        </div>
      </div>

      {/* In-app notifications */}
      <div>
        <h3 className="text-xs font-medium text-subtle uppercase tracking-wider mb-3">
          In-app notifications
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-sm">Show notification bell</span>
          <Toggle
            checked={preferences?.inAppEnabled ?? true}
            onChange={(checked) => updatePrefsMutation.mutate({ inAppEnabled: checked })}
          />
        </div>
      </div>

      {/* Email notifications */}
      <div>
        <h3 className="text-xs font-medium text-subtle uppercase tracking-wider mb-3">
          Email notifications
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Immediate alerts for security updates</span>
            <Toggle
              checked={preferences?.emailImmediateCritical ?? true}
              onChange={(checked) => updatePrefsMutation.mutate({ emailImmediateCritical: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Email digest</span>
            <Toggle
              checked={preferences?.emailDigestEnabled ?? false}
              onChange={(checked) => updatePrefsMutation.mutate({ emailDigestEnabled: checked })}
            />
          </div>
          {preferences?.emailDigestEnabled && (
            <div className="ml-4 flex items-center gap-2">
              <span className="text-xs text-muted">Frequency:</span>
              <select
                value={preferences.emailDigestFrequency || "daily"}
                onChange={(e) =>
                  updatePrefsMutation.mutate({
                    emailDigestFrequency: e.target.value as "daily" | "weekly",
                  })
                }
                className="bg-transparent border border-border px-2 py-1 text-xs focus:outline-none focus:border-foreground"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Slack integration */}
      <div>
        <h3 className="text-xs font-medium text-subtle uppercase tracking-wider mb-3">
          Slack integration
        </h3>
        {slackIntegrations.length === 0 ? (
          <button
            onClick={() => connectSlackMutation.mutate()}
            disabled={connectSlackMutation.isPending}
            className="text-sm text-muted hover:text-foreground transition-colors flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
            </svg>
            {connectSlackMutation.isPending ? "Connecting..." : "Connect Slack"}
          </button>
        ) : (
          <div className="space-y-2">
            {slackIntegrations.map((integration) => (
              <div
                key={integration.id}
                className="flex items-center justify-between border border-border p-3"
              >
                <div className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-muted">
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
                  </svg>
                  <span className="text-sm">{integration.displayName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Toggle
                    checked={integration.enabled}
                    onChange={(enabled) =>
                      toggleMutation.mutate({ id: integration.id, enabled })
                    }
                  />
                  <button
                    onClick={() => disconnectMutation.mutate(integration.id)}
                    className="text-xs text-subtle hover:text-red-500 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={() => connectSlackMutation.mutate()}
              disabled={connectSlackMutation.isPending}
              className="text-xs text-subtle hover:text-foreground transition-colors"
            >
              + Connect another workspace
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main Profile Page
// =============================================================================

function ProfileContent() {
  const { data: session, isPending } = useSession();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"profile" | "notifications">("profile");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Handle URL tab parameter
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "notifications") {
      setActiveTab("notifications");
    }
  }, [searchParams]);

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

      <h1 className="text-xl font-bold mt-6 mb-6">Profile</h1>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border mb-6">
        <button
          onClick={() => setActiveTab("profile")}
          className={`pb-2 text-sm transition-colors ${
            activeTab === "profile"
              ? "text-foreground border-b-2 border-foreground"
              : "text-muted hover:text-foreground"
          }`}
        >
          Profile
        </button>
        <button
          onClick={() => setActiveTab("notifications")}
          className={`pb-2 text-sm transition-colors ${
            activeTab === "notifications"
              ? "text-foreground border-b-2 border-foreground"
              : "text-muted hover:text-foreground"
          }`}
        >
          Notifications
        </button>
      </div>

      {activeTab === "profile" ? (
        <>
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
        </>
      ) : (
        <section className="border border-border p-6">
          <h2 className="text-sm font-medium mb-6">Notification Settings</h2>
          <NotificationPreferencesSection />
        </section>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 bg-surface/50 animate-pulse" />
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}

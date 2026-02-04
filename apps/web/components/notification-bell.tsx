"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// =============================================================================
// Types
// =============================================================================

interface Notification {
  id: string;
  packageName: string;
  newVersion: string;
  previousVersion?: string;
  severity: "critical" | "important" | "info";
  isSecurityUpdate: boolean;
  isBreakingChange: boolean;
  changelogSnippet?: string;
  vulnerabilitiesFixed?: number;
  read: boolean;
  createdAt: string;
}

interface UnreadCount {
  total: number;
  critical: number;
  important: number;
  info: number;
}

// =============================================================================
// API Functions
// =============================================================================

interface NotificationPreferences {
  inAppEnabled: boolean;
}

async function fetchUnreadCount(): Promise<UnreadCount> {
  if (!API_URL) throw new Error("API URL not configured");
  const res = await fetch(`${API_URL}/api/notifications/unread-count`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch unread count");
  return res.json();
}

async function fetchPreferences(): Promise<NotificationPreferences> {
  if (!API_URL) throw new Error("API URL not configured");
  const res = await fetch(`${API_URL}/api/notifications/preferences`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch preferences");
  const data = await res.json();
  return data.preferences;
}

async function fetchNotifications(limit = 10): Promise<Notification[]> {
  if (!API_URL) throw new Error("API URL not configured");
  const res = await fetch(`${API_URL}/api/notifications?limit=${limit}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch notifications");
  const data = await res.json();
  return data.notifications;
}

async function markAsRead(id: string): Promise<void> {
  if (!API_URL) throw new Error("API URL not configured");
  const res = await fetch(`${API_URL}/api/notifications/${id}/read`, {
    method: "PATCH",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to mark as read");
}

async function markAllAsRead(): Promise<void> {
  if (!API_URL) throw new Error("API URL not configured");
  const res = await fetch(`${API_URL}/api/notifications/read-all`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to mark all as read");
}

// =============================================================================
// Components
// =============================================================================

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "critical") {
    return (
      <span className="text-red-500" title="Security update">
        ●
      </span>
    );
  }
  if (severity === "important") {
    return (
      <span className="text-yellow-500" title="Breaking change">
        ●
      </span>
    );
  }
  return (
    <span className="text-blue-500" title="Update">
      ●
    </span>
  );
}

function NotificationItem({
  notification,
  onRead,
}: {
  notification: Notification;
  onRead: () => void;
}) {
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true });

  return (
    <DropdownMenuItem
      asChild
      className={`cursor-pointer px-3 py-2 ${notification.read ? "opacity-60" : ""}`}
      onClick={onRead}
    >
      <Link href={`/${encodeURIComponent(notification.packageName)}`} className="block w-full">
        <div className="flex items-start gap-2">
          <SeverityIcon severity={notification.severity} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs truncate">{notification.packageName}</span>
              <span className="text-[10px] text-muted shrink-0">
                {notification.previousVersion ? (
                  <>
                    {notification.previousVersion} → {notification.newVersion}
                  </>
                ) : (
                  notification.newVersion
                )}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {notification.isSecurityUpdate && (
                <span className="text-[10px] text-red-400">Security fix</span>
              )}
              {notification.isBreakingChange && (
                <span className="text-[10px] text-yellow-400">Breaking</span>
              )}
              <span className="text-[10px] text-muted">{timeAgo}</span>
            </div>
          </div>
        </div>
      </Link>
    </DropdownMenuItem>
  );
}

export function NotificationBell() {
  const { data: session, isPending: sessionPending } = useSession();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  // Fetch preferences to check if bell should be shown
  const { data: preferences } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: fetchPreferences,
    enabled: !!session?.user,
    staleTime: 60000, // Cache for 1 minute
  });

  // Fetch unread count (poll every 30 seconds)
  const { data: unreadCount } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: fetchUnreadCount,
    enabled: !!session?.user && preferences?.inAppEnabled !== false,
    refetchInterval: 30000,
    staleTime: 10000,
  });

  // Fetch recent notifications when dropdown opens
  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications", "recent"],
    queryFn: () => fetchNotifications(10),
    enabled: !!session?.user && isOpen,
    staleTime: 10000,
  });

  // Mutation: mark single notification as read
  const markReadMutation = useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Mutation: mark all as read
  const markAllReadMutation = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Don't render while session is loading
  if (sessionPending) {
    return null;
  }

  // Don't render if not logged in
  if (!session?.user) {
    return null;
  }

  // Don't render if user has disabled in-app notifications
  if (preferences?.inAppEnabled === false) {
    return null;
  }

  const totalUnread = unreadCount?.total || 0;
  const hasCritical = (unreadCount?.critical || 0) > 0;

  return (
    <DropdownMenu modal={false} open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative focus:outline-none text-subtle hover:text-foreground transition-colors"
          aria-label={`Notifications${totalUnread > 0 ? ` (${totalUnread} unread)` : ""}`}
        >
          {/* Bell icon */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>

          {/* Badge */}
          {totalUnread > 0 && (
            <span
              className={`absolute -top-1.5 -right-1.5 text-[8px] min-w-[12px] h-[12px] flex items-center justify-center rounded-full font-medium ${
                hasCritical ? "bg-red-500 text-white" : "bg-foreground text-background"
              }`}
            >
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 max-h-[400px] overflow-y-auto bg-background border-border"
      >
        <DropdownMenuLabel className="flex items-center justify-between px-3 py-2">
          <span className="text-xs font-medium">Notifications</span>
          {totalUnread > 0 && (
            <button
              onClick={(e) => {
                e.preventDefault();
                markAllReadMutation.mutate();
              }}
              className="text-[10px] text-muted hover:text-foreground transition-colors"
            >
              Mark all as read
            </button>
          )}
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-border" />

        {isLoading ? (
          <div className="px-3 py-4 text-center text-xs text-muted">Loading...</div>
        ) : !notifications?.length ? (
          <div className="px-3 py-4 text-center text-xs text-muted">No notifications yet</div>
        ) : (
          <>
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onRead={() => {
                  if (!notification.read) {
                    markReadMutation.mutate(notification.id);
                  }
                }}
              />
            ))}
          </>
        )}

        <DropdownMenuSeparator className="bg-border" />

        <DropdownMenuItem
          asChild
          className="text-xs text-center justify-center text-muted hover:text-foreground cursor-pointer"
        >
          <Link href="/profile?tab=notifications">View all & settings</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Notifications Procedures
 *
 * oRPC procedures for user notifications (protected routes).
 */

import { ORPCError } from "@orpc/server";
import { protectedProcedure } from "@packrun/api";
import {
  NotificationPreferencesResponseSchema,
  NotificationPreferencesSchema,
  NotificationsListResponseSchema,
  SuccessResponseSchema,
  UnreadCountResponseSchema,
} from "@packrun/api/schemas";
import { db } from "@packrun/db/client";
import {
  getNotificationPreferences,
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  upsertNotificationPreferences,
} from "@packrun/db/queries";
import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";

/**
 * Get notifications
 */
export const list = protectedProcedure
  .route({
    method: "GET",
    path: "/api/notifications",
    summary: "Get notifications",
    description: "Get the user's notifications with optional filtering",
    tags: ["Notifications"],
  })
  .input(
    z.object({
      severity: z.string().optional().describe("Filter by severity (comma-separated)"),
      unreadOnly: z.coerce.boolean().optional().describe("Only return unread notifications"),
      limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
      offset: z.coerce.number().int().min(0).default(0).optional(),
    }),
  )
  .output(NotificationsListResponseSchema)
  .handler(async ({ input, context }) => {
    if (!db) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Database not configured",
      });
    }

    const severities = input.severity?.split(",").filter(Boolean);

    const result = await listNotifications(db, context.user.id, {
      severity: severities,
      unreadOnly: input.unreadOnly,
      limit: input.limit ?? 20,
      offset: input.offset ?? 0,
    });

    return {
      notifications: result.notifications.map((n) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
      })),
      total: result.total,
      unreadCount: result.unreadCount,
    };
  });

/**
 * Get unread count
 */
export const unreadCount = protectedProcedure
  .route({
    method: "GET",
    path: "/api/notifications/unread-count",
    summary: "Get unread count",
    description: "Get the count of unread notifications (for badge display)",
    tags: ["Notifications"],
  })
  .output(UnreadCountResponseSchema)
  .handler(async ({ context }) => {
    if (!db) {
      return { total: 0, critical: 0 };
    }

    return getUnreadCount(db, context.user.id);
  });

/**
 * Mark notification as read
 */
export const markAsRead = protectedProcedure
  .route({
    method: "PATCH",
    path: "/api/notifications/{id}/read",
    summary: "Mark notification as read",
    description: "Mark a single notification as read",
    tags: ["Notifications"],
  })
  .input(z.object({ id: z.string() }))
  .output(SuccessResponseSchema)
  .handler(async ({ input, context }) => {
    if (!db) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Database not configured",
      });
    }

    await markNotificationRead(db, context.user.id, input.id);
    return { success: true };
  });

/**
 * Mark all as read
 */
export const markAllAsRead = protectedProcedure
  .route({
    method: "POST",
    path: "/api/notifications/read-all",
    summary: "Mark all as read",
    description: "Mark all notifications as read",
    tags: ["Notifications"],
  })
  .output(SuccessResponseSchema)
  .handler(async ({ context }) => {
    if (!db) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Database not configured",
      });
    }

    await markAllNotificationsRead(db, context.user.id);
    return { success: true };
  });

/**
 * Get notification preferences
 */
export const getPreferences = protectedProcedure
  .route({
    method: "GET",
    path: "/api/notifications/preferences",
    summary: "Get notification preferences",
    description: "Get the user's notification preferences",
    tags: ["Notifications"],
  })
  .output(NotificationPreferencesResponseSchema)
  .handler(async ({ context }) => {
    if (!db) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Database not configured",
      });
    }

    const prefs = await getNotificationPreferences(db, context.user.id);

    return {
      preferences: {
        notifyAllUpdates: prefs.notifyAllUpdates ?? false,
        notifyMajorOnly: prefs.notifyMajorOnly ?? true,
        notifySecurityOnly: prefs.notifySecurityOnly ?? true,
        inAppEnabled: prefs.inAppEnabled ?? true,
        emailDigestEnabled: prefs.emailDigestEnabled ?? false,
        emailDigestFrequency: (prefs.emailDigestFrequency as "daily" | "weekly" | null) ?? "daily",
        emailImmediateCritical: prefs.emailImmediateCritical ?? true,
      },
    };
  });

/**
 * Update notification preferences
 */
export const updatePreferences = protectedProcedure
  .route({
    method: "PUT",
    path: "/api/notifications/preferences",
    summary: "Update notification preferences",
    description: "Update the user's notification preferences",
    tags: ["Notifications"],
  })
  .input(NotificationPreferencesSchema.partial())
  .output(NotificationPreferencesResponseSchema)
  .handler(async ({ input, context }) => {
    if (!db) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Database not configured",
      });
    }

    const updated = await upsertNotificationPreferences(db, createId(), context.user.id, input);

    return {
      preferences: {
        notifyAllUpdates: updated.notifyAllUpdates ?? false,
        notifyMajorOnly: updated.notifyMajorOnly ?? true,
        notifySecurityOnly: updated.notifySecurityOnly ?? true,
        inAppEnabled: updated.inAppEnabled ?? true,
        emailDigestEnabled: updated.emailDigestEnabled ?? false,
        emailDigestFrequency:
          (updated.emailDigestFrequency as "daily" | "weekly" | null) ?? "daily",
        emailImmediateCritical: updated.emailImmediateCritical ?? true,
      },
    };
  });

// =============================================================================
// Router
// =============================================================================

export const notificationsRouter = {
  list,
  unreadCount,
  markAsRead,
  markAllAsRead,
  getPreferences,
  updatePreferences,
};

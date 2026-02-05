/**
 * Database Queries
 *
 * Reusable query functions for the packrun.dev database.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import type { Database } from "./client";
import { favorite, notification, notificationPreferences, user } from "./schema";

// =============================================================================
// Types
// =============================================================================

export interface UserWithFavoriteAndPreferences {
  userId: string;
  email: string;
  notifyAllUpdates: boolean;
  notifyMajorOnly: boolean;
  notifySecurityOnly: boolean;
  inAppEnabled: boolean;
  emailDigestEnabled: boolean;
  emailImmediateCritical: boolean;
}

export interface NotificationInsert {
  id: string;
  userId: string;
  packageName: string;
  newVersion: string;
  previousVersion: string | null;
  severity: "critical" | "important" | "info";
  isSecurityUpdate: boolean;
  isBreakingChange: boolean;
  changelogSnippet: string | null;
  vulnerabilitiesFixed: number | null;
}

export interface NotificationRecord {
  id: string;
  packageName: string;
  newVersion: string;
  previousVersion: string | null;
  severity: "critical" | "important" | "info";
  isSecurityUpdate: boolean;
  isBreakingChange: boolean;
  changelogSnippet: string | null;
  vulnerabilitiesFixed: number | null;
  read: boolean;
  createdAt: Date;
}

export interface NotificationListOptions {
  severity?: string[];
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface NotificationPreferencesData {
  notifyAllUpdates?: boolean;
  notifyMajorOnly?: boolean;
  notifySecurityOnly?: boolean;
  inAppEnabled?: boolean;
  emailDigestEnabled?: boolean;
  emailDigestFrequency?: string | null;
  emailImmediateCritical?: boolean;
}

// =============================================================================
// User Queries
// =============================================================================

/**
 * Get users who favorited a package along with their notification preferences
 */
export async function getUsersWithFavoritesForPackage(
  db: Database,
  packageName: string,
): Promise<UserWithFavoriteAndPreferences[]> {
  const results = await db
    .select({
      userId: favorite.userId,
      email: user.email,
      notifyAllUpdates: notificationPreferences.notifyAllUpdates,
      notifyMajorOnly: notificationPreferences.notifyMajorOnly,
      notifySecurityOnly: notificationPreferences.notifySecurityOnly,
      inAppEnabled: notificationPreferences.inAppEnabled,
      emailDigestEnabled: notificationPreferences.emailDigestEnabled,
      emailImmediateCritical: notificationPreferences.emailImmediateCritical,
    })
    .from(favorite)
    .innerJoin(user, eq(favorite.userId, user.id))
    .leftJoin(notificationPreferences, eq(favorite.userId, notificationPreferences.userId))
    .where(eq(favorite.packageName, packageName));

  return results.map((row) => ({
    userId: row.userId,
    email: row.email,
    // Apply defaults for users without preferences
    notifyAllUpdates: row.notifyAllUpdates ?? false,
    notifyMajorOnly: row.notifyMajorOnly ?? true,
    notifySecurityOnly: row.notifySecurityOnly ?? true,
    inAppEnabled: row.inAppEnabled ?? true,
    emailDigestEnabled: row.emailDigestEnabled ?? false,
    emailImmediateCritical: row.emailImmediateCritical ?? true,
  }));
}

/**
 * Delete a user and cascade to all related data
 */
export async function deleteUser(db: Database, userId: string): Promise<void> {
  await db.delete(user).where(eq(user.id, userId));
}

// =============================================================================
// Favorites Queries
// =============================================================================

/**
 * Get user's favorited packages
 */
export async function listFavorites(db: Database, userId: string): Promise<string[]> {
  const results = await db
    .select({ packageName: favorite.packageName })
    .from(favorite)
    .where(eq(favorite.userId, userId))
    .orderBy(favorite.createdAt);

  return results.map((f) => f.packageName);
}

/**
 * Add a package to user's favorites (ignores duplicates)
 */
export async function addFavorite(
  db: Database,
  id: string,
  userId: string,
  packageName: string,
): Promise<void> {
  await db.insert(favorite).values({ id, userId, packageName }).onConflictDoNothing();
}

/**
 * Remove a package from user's favorites
 */
export async function removeFavorite(
  db: Database,
  userId: string,
  packageName: string,
): Promise<void> {
  await db
    .delete(favorite)
    .where(and(eq(favorite.userId, userId), eq(favorite.packageName, packageName)));
}

/**
 * Check if a package is in user's favorites
 */
export async function checkFavorite(
  db: Database,
  userId: string,
  packageName: string,
): Promise<boolean> {
  const result = await db
    .select({ id: favorite.id })
    .from(favorite)
    .where(and(eq(favorite.userId, userId), eq(favorite.packageName, packageName)))
    .limit(1);

  return result.length > 0;
}

// =============================================================================
// Notification Queries
// =============================================================================

/**
 * Insert a notification record (ignores duplicates)
 */
export async function insertNotification(db: Database, data: NotificationInsert): Promise<void> {
  await db
    .insert(notification)
    .values({
      id: data.id,
      userId: data.userId,
      packageName: data.packageName,
      newVersion: data.newVersion,
      previousVersion: data.previousVersion,
      severity: data.severity,
      isSecurityUpdate: data.isSecurityUpdate,
      isBreakingChange: data.isBreakingChange,
      changelogSnippet: data.changelogSnippet,
      vulnerabilitiesFixed: data.vulnerabilitiesFixed,
      read: false,
    })
    .onConflictDoNothing({
      target: [notification.userId, notification.packageName, notification.newVersion],
    });
}

/**
 * List notifications with filtering and pagination
 */
export async function listNotifications(
  db: Database,
  userId: string,
  options: NotificationListOptions = {},
): Promise<{ notifications: NotificationRecord[]; total: number; unreadCount: number }> {
  const { severity, unreadOnly, limit = 20, offset = 0 } = options;

  // Build query conditions
  const conditions = [eq(notification.userId, userId)];

  if (unreadOnly) {
    conditions.push(eq(notification.read, false));
  }

  if (severity && severity.length > 0) {
    conditions.push(sql`${notification.severity} = ANY(${severity})`);
  }

  // Get notifications
  const notifications = await db
    .select()
    .from(notification)
    .where(and(...conditions))
    .orderBy(desc(notification.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total and unread counts
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notification)
    .where(eq(notification.userId, userId));

  const [unreadResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notification)
    .where(and(eq(notification.userId, userId), eq(notification.read, false)));

  return {
    notifications: notifications.map((n) => ({
      id: n.id,
      packageName: n.packageName,
      newVersion: n.newVersion,
      previousVersion: n.previousVersion,
      severity: n.severity as "critical" | "important" | "info",
      isSecurityUpdate: n.isSecurityUpdate,
      isBreakingChange: n.isBreakingChange,
      changelogSnippet: n.changelogSnippet,
      vulnerabilitiesFixed: n.vulnerabilitiesFixed,
      read: n.read,
      createdAt: n.createdAt,
    })),
    total: Number(countResult?.count || 0),
    unreadCount: Number(unreadResult?.count || 0),
  };
}

/**
 * Get unread notification counts
 */
export async function getUnreadCount(
  db: Database,
  userId: string,
): Promise<{ total: number; critical: number }> {
  const [totalResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notification)
    .where(and(eq(notification.userId, userId), eq(notification.read, false)));

  const [criticalResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notification)
    .where(
      and(
        eq(notification.userId, userId),
        eq(notification.read, false),
        eq(notification.severity, "critical"),
      ),
    );

  return {
    total: Number(totalResult?.count || 0),
    critical: Number(criticalResult?.count || 0),
  };
}

/**
 * Mark a single notification as read
 */
export async function markNotificationRead(
  db: Database,
  userId: string,
  notificationId: string,
): Promise<void> {
  await db
    .update(notification)
    .set({ read: true })
    .where(and(eq(notification.id, notificationId), eq(notification.userId, userId)));
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead(db: Database, userId: string): Promise<void> {
  await db
    .update(notification)
    .set({ read: true })
    .where(and(eq(notification.userId, userId), eq(notification.read, false)));
}

/**
 * Get notification preferences for a user (returns defaults if none exist)
 */
export async function getNotificationPreferences(
  db: Database,
  userId: string,
): Promise<NotificationPreferencesData> {
  const [prefs] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);

  // Return defaults if no preferences exist
  return (
    prefs || {
      notifyAllUpdates: false,
      notifyMajorOnly: true,
      notifySecurityOnly: true,
      inAppEnabled: true,
      emailDigestEnabled: false,
      emailDigestFrequency: "daily",
      emailImmediateCritical: true,
    }
  );
}

/**
 * Create or update notification preferences
 */
export async function upsertNotificationPreferences(
  db: Database,
  id: string,
  userId: string,
  data: NotificationPreferencesData,
): Promise<NotificationPreferencesData> {
  const [existing] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);

  let updated;
  if (existing) {
    [updated] = await db
      .update(notificationPreferences)
      .set(data)
      .where(eq(notificationPreferences.userId, userId))
      .returning();
  } else {
    [updated] = await db
      .insert(notificationPreferences)
      .values({ id, userId, ...data })
      .returning();
  }

  return {
    notifyAllUpdates: updated!.notifyAllUpdates,
    notifyMajorOnly: updated!.notifyMajorOnly,
    notifySecurityOnly: updated!.notifySecurityOnly,
    inAppEnabled: updated!.inAppEnabled,
    emailDigestEnabled: updated!.emailDigestEnabled,
    emailDigestFrequency: updated!.emailDigestFrequency,
    emailImmediateCritical: updated!.emailImmediateCritical,
  };
}

/**
 * Disable email notifications for a user (for unsubscribe)
 */
export async function disableEmailNotifications(
  db: Database,
  id: string,
  userId: string,
): Promise<boolean> {
  try {
    const [existing] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    if (existing) {
      await db
        .update(notificationPreferences)
        .set({
          emailDigestEnabled: false,
          emailImmediateCritical: false,
        })
        .where(eq(notificationPreferences.userId, userId));
    } else {
      await db.insert(notificationPreferences).values({
        id,
        userId,
        emailDigestEnabled: false,
        emailImmediateCritical: false,
      });
    }

    return true;
  } catch (error) {
    console.error("[DB] Error disabling email notifications:", error);
    return false;
  }
}

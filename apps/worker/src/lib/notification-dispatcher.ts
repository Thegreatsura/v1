/**
 * Notification Dispatcher
 *
 * Creates notifications for users who favorited a package and
 * dispatches to appropriate channels (in-app, Slack, email).
 */

import { createId } from "@paralleldrive/cuid2";
import { getQueue } from "@v1/queue";
import {
  SLACK_DELIVERY_QUEUE,
  EMAIL_DELIVERY_QUEUE,
  EXTERNAL_API_RETRY,
  type SlackDeliveryJobData,
  type EmailDeliveryJobData,
} from "@v1/queue/delivery";
import { db, isDatabaseAvailable } from "@v1/db/client";
import type { NotificationEnrichment } from "./notification-enrichment";

// =============================================================================
// Types
// =============================================================================

interface NotificationData {
  packageName: string;
  newVersion: string;
  previousVersion: string | null;
  severity: "critical" | "important" | "info";
  isSecurityUpdate: boolean;
  isBreakingChange: boolean;
  changelogSnippet: string | null;
  vulnerabilitiesFixed: number | null;
}

interface UserWithPreferences {
  userId: string;
  email: string;
  notifyAllUpdates: boolean;
  notifyMajorOnly: boolean;
  notifySecurityOnly: boolean;
  inAppEnabled: boolean;
  slackEnabled: boolean;
  emailDigestEnabled: boolean;
  emailImmediateCritical: boolean;
}

interface SlackIntegration {
  id: string;
  userId: string;
  config: {
    channelId: string;
    accessToken: string;
  };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Check if user wants to be notified based on their preferences
 */
function shouldNotifyUser(
  prefs: Partial<UserWithPreferences> | null,
  severity: string,
  isSecurityUpdate: boolean,
): boolean {
  // Default behavior (no prefs): notify on major + security only
  if (!prefs) {
    return severity !== "info" || isSecurityUpdate;
  }

  if (prefs.notifyAllUpdates) return true;
  if (prefs.notifySecurityOnly && isSecurityUpdate) return true;
  if (prefs.notifyMajorOnly && severity !== "info") return true;

  return false;
}

// =============================================================================
// Main Dispatcher
// =============================================================================

/**
 * Dispatch notifications for a package update
 *
 * 1. Find all users who favorited the package
 * 2. Filter by user preferences
 * 3. Create in-app notifications
 * 4. Queue Slack messages
 * 5. Queue immediate emails (critical only)
 */
export async function dispatchNotifications(
  packageName: string,
  enrichment: NotificationEnrichment,
  previousVersion: string | null,
  newVersion: string,
): Promise<{ notified: number; skipped: number }> {
  if (!isDatabaseAvailable() || !db) {
    console.log(`[Dispatcher] Database not available, skipping notifications for ${packageName}`);
    return { notified: 0, skipped: 0 };
  }

  const notificationData: NotificationData = {
    packageName,
    newVersion,
    previousVersion,
    severity: enrichment.severity,
    isSecurityUpdate: enrichment.securityAnalysis.isSecurityUpdate,
    isBreakingChange: enrichment.versionAnalysis.isBreakingChange,
    changelogSnippet: enrichment.changelogSnippet,
    vulnerabilitiesFixed: enrichment.securityAnalysis.vulnerabilitiesFixed || null,
  };

  try {
    // Find users who favorited this package along with their preferences
    const usersWithFavorites = await db.execute<{
      user_id: string;
      email: string;
      notify_all_updates: boolean | null;
      notify_major_only: boolean | null;
      notify_security_only: boolean | null;
      in_app_enabled: boolean | null;
      slack_enabled: boolean | null;
      email_digest_enabled: boolean | null;
      email_immediate_critical: boolean | null;
    }>`
      SELECT 
        f.user_id,
        u.email,
        np.notify_all_updates,
        np.notify_major_only,
        np.notify_security_only,
        np.in_app_enabled,
        np.slack_enabled,
        np.email_digest_enabled,
        np.email_immediate_critical
      FROM favorite f
      JOIN "user" u ON f.user_id = u.id
      LEFT JOIN notification_preferences np ON f.user_id = np.user_id
      WHERE f.package_name = ${packageName}
    `;

    if (usersWithFavorites.length === 0) {
      return { notified: 0, skipped: 0 };
    }

    let notified = 0;
    let skipped = 0;

    // Process each user
    for (const row of usersWithFavorites) {
      const prefs: Partial<UserWithPreferences> = {
        notifyAllUpdates: row.notify_all_updates ?? false,
        notifyMajorOnly: row.notify_major_only ?? true,
        notifySecurityOnly: row.notify_security_only ?? true,
        inAppEnabled: row.in_app_enabled ?? true,
        slackEnabled: row.slack_enabled ?? false,
        emailDigestEnabled: row.email_digest_enabled ?? false,
        emailImmediateCritical: row.email_immediate_critical ?? true,
      };

      // Check if user wants this notification
      if (!shouldNotifyUser(prefs, notificationData.severity, notificationData.isSecurityUpdate)) {
        skipped++;
        continue;
      }

      // Create in-app notification (if enabled)
      if (prefs.inAppEnabled !== false) {
        await createInAppNotification(row.user_id, notificationData);
      }

      // Queue Slack notification (if enabled)
      if (prefs.slackEnabled) {
        await queueSlackNotification(row.user_id, notificationData);
      }

      // Queue immediate email for critical notifications
      if (prefs.emailImmediateCritical && notificationData.severity === "critical") {
        await queueImmediateEmail(row.user_id, row.email, notificationData);
      }

      notified++;
    }

    console.log(
      `[Dispatcher] ${packageName}@${newVersion}: ${notified} notified, ${skipped} skipped (severity: ${notificationData.severity})`,
    );

    return { notified, skipped };
  } catch (error) {
    console.error(`[Dispatcher] Error dispatching notifications for ${packageName}:`, error);
    return { notified: 0, skipped: 0 };
  }
}

// =============================================================================
// Channel-specific Functions
// =============================================================================

/**
 * Create in-app notification record
 */
async function createInAppNotification(userId: string, data: NotificationData): Promise<void> {
  if (!db) return;

  try {
    await db.execute`
      INSERT INTO notification (
        id, user_id, package_name, new_version, previous_version,
        severity, is_security_update, is_breaking_change,
        changelog_snippet, vulnerabilities_fixed, read, created_at
      ) VALUES (
        ${createId()}, ${userId}, ${data.packageName}, ${data.newVersion}, ${data.previousVersion},
        ${data.severity}, ${data.isSecurityUpdate}, ${data.isBreakingChange},
        ${data.changelogSnippet}, ${data.vulnerabilitiesFixed}, false, NOW()
      )
      ON CONFLICT (user_id, package_name, new_version) DO NOTHING
    `;
  } catch (error) {
    console.error(`[Dispatcher] Error creating in-app notification:`, error);
  }
}

/**
 * Queue Slack notification
 */
async function queueSlackNotification(userId: string, data: NotificationData): Promise<void> {
  if (!db) return;

  try {
    // Find user's Slack integration
    const integrations = await db.execute<{
      id: string;
      config: unknown;
    }>`
      SELECT id, config FROM integration_connection
      WHERE user_id = ${userId} AND provider = 'slack' AND enabled = true
      LIMIT 1
    `;

    if (integrations.length === 0) return;

    const integration = integrations[0]!;
    const slackQueue = getQueue<SlackDeliveryJobData>({ name: SLACK_DELIVERY_QUEUE });

    await slackQueue.add(
      "send",
      {
        integrationId: integration.id,
        userId,
        notification: {
          packageName: data.packageName,
          newVersion: data.newVersion,
          previousVersion: data.previousVersion || undefined,
          severity: data.severity,
          isSecurityUpdate: data.isSecurityUpdate,
          isBreakingChange: data.isBreakingChange,
          changelogSnippet: data.changelogSnippet || undefined,
          vulnerabilitiesFixed: data.vulnerabilitiesFixed || undefined,
        },
      },
      {
        ...EXTERNAL_API_RETRY,
        jobId: `slack-${userId}-${data.packageName}-${data.newVersion}`,
      },
    );
  } catch (error) {
    console.error(`[Dispatcher] Error queuing Slack notification:`, error);
  }
}

/**
 * Queue immediate email for critical notifications
 */
async function queueImmediateEmail(
  userId: string,
  email: string,
  data: NotificationData,
): Promise<void> {
  try {
    const emailQueue = getQueue<EmailDeliveryJobData>({ name: EMAIL_DELIVERY_QUEUE });

    await emailQueue.add(
      "send",
      {
        to: email,
        userId,
        template: "critical-alert",
        props: {
          packageName: data.packageName,
          newVersion: data.newVersion,
          previousVersion: data.previousVersion || undefined,
          vulnerabilitiesFixed: data.vulnerabilitiesFixed || 0,
          changelogSnippet: data.changelogSnippet || undefined,
        },
      },
      {
        ...EXTERNAL_API_RETRY,
        jobId: `email-${userId}-${data.packageName}-${data.newVersion}`,
      },
    );
  } catch (error) {
    console.error(`[Dispatcher] Error queuing email:`, error);
  }
}

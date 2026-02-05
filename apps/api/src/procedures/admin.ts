/**
 * Admin Procedures
 *
 * oRPC procedures for admin operations (health check, test email, etc.).
 */

import { ORPCError } from "@orpc/server";
import { publicProcedure } from "@packrun/api";
import {
  HealthResponseSchema,
  TestEmailInputSchema,
  TestEmailResponseSchema,
} from "@packrun/api/schemas";
import { Digest, type DigestUpdate, sendEmail } from "@packrun/email";
import React from "react";
import { z } from "zod";

/**
 * Health check
 */
export const health = publicProcedure
  .route({
    method: "GET",
    path: "/health",
    summary: "Health check",
    description: "Check if the API is healthy",
    tags: ["Admin"],
  })
  .output(HealthResponseSchema)
  .handler(async () => {
    return {
      status: "healthy" as const,
      timestamp: new Date().toISOString(),
      service: "packrun-api",
    };
  });

/**
 * Send test email
 * Protected by admin secret header
 */
export const testEmail = publicProcedure
  .route({
    method: "POST",
    path: "/test-email",
    summary: "Send test email",
    description: "Send a test digest email (requires admin secret)",
    tags: ["Admin"],
  })
  .input(
    TestEmailInputSchema.extend({
      adminSecret: z.string().describe("Admin secret for authorization"),
    }),
  )
  .output(TestEmailResponseSchema)
  .handler(async ({ input, context }) => {
    // Check admin secret from header or input
    const adminSecretHeader = context.headers.get("x-admin-secret");
    const adminSecret = adminSecretHeader || input.adminSecret;

    if (adminSecret !== process.env.ADMIN_SECRET) {
      throw new ORPCError("UNAUTHORIZED", {
        message: "Invalid admin secret",
      });
    }

    const packageName = input.package || "ai";

    const updates: DigestUpdate[] = [
      {
        packageName,
        newVersion: "4.1.0",
        previousVersion: "4.0.3",
        severity: "critical",
        isSecurityUpdate: true,
        isBreakingChange: false,
        vulnerabilitiesFixed: 1,
        changelogSnippet: "Security fix for prompt injection vulnerability",
      },
      {
        packageName,
        newVersion: "4.0.0",
        previousVersion: "3.4.7",
        severity: "important",
        isSecurityUpdate: false,
        isBreakingChange: true,
        changelogSnippet: "New streaming API, deprecated generateText()",
      },
      {
        packageName: `@${packageName}-sdk/provider`,
        newVersion: "1.2.0",
        previousVersion: "1.1.0",
        severity: "info",
        isSecurityUpdate: false,
        isBreakingChange: false,
      },
    ];

    const emailElement = React.createElement(Digest, {
      updates,
      period: "daily",
      unsubscribeUrl: "https://packrun.dev/api/unsubscribe?token=test",
    });

    try {
      const result = await sendEmail({
        to: input.email,
        subject: `📦 Test digest: ${updates.length} package updates`,
        react: emailElement,
      });

      return { success: true, result };
    } catch (error) {
      console.error("[Admin] Test email error:", error);
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: `Failed to send email: ${String(error)}`,
      });
    }
  });

// =============================================================================
// Router
// =============================================================================

export const adminRouter = {
  health,
  testEmail,
};

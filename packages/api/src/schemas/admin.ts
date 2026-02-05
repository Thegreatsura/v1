/**
 * Admin Schemas
 *
 * Zod schemas for admin-related API responses (health check, test email, etc.).
 */

import { z } from "zod";

// =============================================================================
// Health Check
// =============================================================================

export const HealthResponseSchema = z.object({
  status: z.literal("healthy"),
  timestamp: z.string(),
  service: z.string(),
});

// =============================================================================
// Test Email
// =============================================================================

export const TestEmailInputSchema = z.object({
  email: z.string().email(),
  package: z.string().optional(),
});

export const TestEmailResponseSchema = z.object({
  success: z.boolean(),
  result: z.unknown().optional(),
});

// Type exports
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type TestEmailInput = z.infer<typeof TestEmailInputSchema>;
export type TestEmailResponse = z.infer<typeof TestEmailResponseSchema>;

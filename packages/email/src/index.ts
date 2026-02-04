/**
 * @v1/email - Email templates and client for v1.run notifications
 */

export {
  resend,
  sendEmail,
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
  RateLimitError,
  type SendEmailOptions,
} from "./client";

export { CriticalAlert, type CriticalAlertProps } from "./templates/critical";
export { Digest, type DigestProps, type DigestUpdate } from "./templates/digest";

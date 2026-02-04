/**
 * Email Digest Worker
 *
 * Processes scheduled digest jobs.
 */

import { createWorker, type Job } from "@v1/queue";
import { EMAIL_DIGEST_QUEUE, type EmailDigestJobData } from "@v1/queue/delivery";
import { processDigests } from "./processor";

/**
 * Process email digest job
 */
async function processEmailDigest(job: Job<EmailDigestJobData>): Promise<void> {
  const { period } = job.data;

  console.log(`[Digest Worker] Processing ${period} digest job`);

  const result = await processDigests(period);

  console.log(
    `[Digest Worker] ${period} digest complete: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`,
  );
}

/**
 * Create and start the email digest worker
 */
export function createEmailDigestWorker() {
  return createWorker<EmailDigestJobData>(EMAIL_DIGEST_QUEUE, processEmailDigest, {
    concurrency: 1, // Process one digest at a time
  });
}

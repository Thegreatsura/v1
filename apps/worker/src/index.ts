/**
 * Worker - Listener Entry Point
 *
 * Listens to npm registry changes and adds jobs to the queue.
 * Run with: bun run src/index.ts
 */

import { config } from "./config";
import { connection } from "./lib/redis";
import { streamChanges } from "./listeners/npm-changes";
import { queuePackageSync, getQueueStats } from "./jobs/npm-sync";

let jobsQueued = 0;
let lastStatsTime = Date.now();

async function logStats() {
  const stats = await getQueueStats();
  const elapsed = (Date.now() - lastStatsTime) / 1000;
  const rate = jobsQueued / elapsed;

  console.log(
    `[Listener] Queued ${jobsQueued} jobs (${rate.toFixed(1)}/s) | ` +
      `Queue: ${stats.sync.waiting} waiting, ${stats.sync.active} active, ${stats.sync.failed} failed`,
  );

  jobsQueued = 0;
  lastStatsTime = Date.now();
}

async function runChangesListener() {
  console.log("Starting npm changes listener...");

  const since = "now";
  let retries = 0;
  const maxRetries = 10;

  while (retries < maxRetries) {
    try {
      console.log(`Listening for changes from: ${since} (attempt ${retries + 1})`);

      for await (const change of streamChanges(since)) {
        // Reset retries on successful data
        retries = 0;

        // Skip design docs
        if (change.id.startsWith("_design/")) {
          continue;
        }

        await queuePackageSync(change.id, change.seq, change.deleted);
        jobsQueued++;

        if (jobsQueued % 100 === 0) {
          await logStats();
        }
      }

      // Stream ended normally, reconnect
      console.log("Changes stream ended, reconnecting...");
    } catch (error) {
      retries++;
      console.error(`Changes listener error (attempt ${retries}/${maxRetries}):`, error);

      if (retries < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retries), 30000); // Exponential backoff, max 30s
        console.log(`Retrying in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Failed to connect to npm changes feed after ${maxRetries} attempts`);
}

async function shutdown() {
  console.log("\nShutting down listener...");
  await logStats();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function main() {
  console.log("Worker Listener starting...");
  console.log(`Typesense: ${config.typesense.nearestNode.host}:${config.typesense.nearestNode.port}`);
  console.log(`Redis: ${connection.host}:${connection.port}`);

  setInterval(logStats, 30000);

  try {
    await runChangesListener();
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main();

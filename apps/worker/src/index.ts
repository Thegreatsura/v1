/**
 * Worker - Listener Entry Point
 *
 * Listens to npm registry changes and adds jobs to the queue.
 * Run with: bun run src/index.ts
 */

import { config } from "./config";
import { connection } from "./lib/redis";
import { pollChanges, getCurrentSeq, type NpmChange } from "./listeners/npm-changes";
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

async function processChanges(changes: NpmChange[]): Promise<void> {
  for (const change of changes) {
    // Skip design docs
    if (change.id.startsWith("_design/")) {
      continue;
    }

    await queuePackageSync(change.id, change.seq, change.deleted);
    jobsQueued++;
  }

  if (changes.length > 0) {
    console.log(`[Listener] Queued ${changes.length} changes (last seq: ${changes[changes.length - 1]?.seq})`);
  }
}

async function runChangesListener() {
  console.log("Starting npm changes listener...");

  // Get current sequence to start from
  const initialSeq = await getCurrentSeq();
  console.log(`Current npm registry sequence: ${initialSeq}`);
  console.log("Polling for changes (npm deprecated continuous streaming)...");

  // Poll for changes - this runs forever
  await pollChanges(initialSeq, processChanges, 5000);
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

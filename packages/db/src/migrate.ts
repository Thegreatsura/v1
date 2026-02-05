/**
 * Database Migration Script
 *
 * Runs migrations programmatically at deploy time.
 * This avoids interactive prompts from drizzle-kit push.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  console.log("Running migrations...");

  // Create a connection for migrations (max 1 connection)
  const migrationClient = postgres(databaseUrl, { max: 1 });
  const db = drizzle(migrationClient);

  try {
    await migrate(db, {
      migrationsFolder: resolve(__dirname, "../drizzle"),
    });
    console.log("Migrations completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

runMigrations();

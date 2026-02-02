/**
 * PostgreSQL Database Connection
 *
 * Uses postgres.js driver with Drizzle ORM for Better Auth
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("[DB] DATABASE_URL not set - database features will be disabled");
}

const client = connectionString ? postgres(connectionString) : null;

export const db = client ? drizzle(client) : null;

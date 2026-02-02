/**
 * Better Auth Configuration
 *
 * Authentication with GitHub OAuth, Drizzle ORM, and LRU cache for sessions
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { cache } from "./cache";
import * as schema from "./auth-schema";

// Only initialize auth if database is available
export const auth = db
  ? betterAuth({
      baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3001",
      basePath: "/api/auth",
      database: drizzleAdapter(db, { provider: "pg", schema }),
      trustedOrigins: ["http://localhost:3000", "https://v1.run", "https://www.v1.run"],

      // Use existing LRU cache for fast session lookups
      secondaryStorage: {
        get: async (key) => cache.get(key),
        set: async (key, value, ttl) => cache.set(key, value, ttl ?? 3600),
        delete: async (key) => cache.delete(key),
      },

      socialProviders: {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID!,
          clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          redirectURI: process.env.BETTER_AUTH_URL
            ? `${process.env.BETTER_AUTH_URL}/api/auth/callback/github`
            : "http://localhost:3001/api/auth/callback/github",
        },
      },

      // Default redirect after sign-in (used when callbackURL not specified)
      session: {
        cookieCache: {
          enabled: true,
          maxAge: 60 * 5, // 5 minutes
        },
      },
    })
  : null;

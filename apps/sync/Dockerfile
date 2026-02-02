# syntax=docker/dockerfile:1

# Base image with Bun (matches packageManager in package.json)
FROM oven/bun:1.3-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app

# Copy workspace config
COPY package.json bun.lock ./
COPY apps/sync/package.json ./apps/sync/
COPY packages/typescript-config/package.json ./packages/typescript-config/

# Install dependencies
RUN bun install --frozen-lockfile

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 worker

# Copy dependencies and source
COPY --from=deps /app/node_modules ./node_modules
COPY apps/sync ./apps/sync
COPY packages/typescript-config ./packages/typescript-config

USER worker

WORKDIR /app/apps/sync

CMD ["bun", "run", "src/index.ts"]

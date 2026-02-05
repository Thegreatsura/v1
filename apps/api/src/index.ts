/**
 * packrun.dev API Server
 *
 * Bun server with oRPC for type-safe RPC and OpenAPI endpoints.
 * Special handlers for SSE streaming, MCP, and unsubscribe pages.
 */

import { handleMcp, handleUnsubscribe, handleUpdatesStream } from "./handlers";
import { auth } from "./lib/auth";
import { getReplacementStats, initReplacements } from "./lib/replacements";
import { handleOpenAPI, handleRPC } from "./orpc-handler";

// =============================================================================
// Initialization
// =============================================================================

const PORT = process.env.PORT || 3001;

// Initialize replacements data
initReplacements();
const replacementStats = getReplacementStats();
console.log(
  `[Startup] Loaded ${replacementStats.totalModules} modules (${replacementStats.nativeModules} native)`,
);

// =============================================================================
// CORS Helper
// =============================================================================

function getCorsHeaders(origin: string | null): Record<string, string> {
  let allowOrigin = "*";
  if (origin?.includes("localhost")) {
    allowOrigin = origin;
  } else if (origin?.endsWith(".packrun.dev") || origin === "https://packrun.dev") {
    allowOrigin = origin;
  }

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, HEAD, PUT, POST, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Cache-Control, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Add CORS headers to a response
 */
function withCors(response: Response, origin: string | null): Response {
  const corsHeaders = getCorsHeaders(origin);
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

// =============================================================================
// Request Handler
// =============================================================================

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    });
  }

  // Route the request and add CORS headers to response
  const response = await routeRequest(request, url);
  return withCors(response, origin);
}

/**
 * Route request to appropriate handler
 */
async function routeRequest(request: Request, url: URL): Promise<Response> {
  // ==========================================================================
  // Special Handlers (non-oRPC)
  // ==========================================================================

  // MCP endpoint (uses Hono internally for @hono/mcp)
  if (url.pathname === "/mcp") {
    return handleMcp(request);
  }

  // Updates SSE stream
  if (url.pathname === "/api/updates/stream") {
    return handleUpdatesStream(request);
  }

  // Unsubscribe HTML pages
  if (url.pathname === "/api/unsubscribe") {
    return handleUnsubscribe(request);
  }

  // ==========================================================================
  // Better Auth
  // ==========================================================================

  if (url.pathname.startsWith("/api/auth/") && auth) {
    const response = await auth.handler(request);
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    return response;
  }

  // ==========================================================================
  // oRPC Handlers
  // ==========================================================================

  // RPC endpoint (type-safe internal clients)
  if (url.pathname.startsWith("/rpc")) {
    const response = await handleRPC(request);
    if (response) {
      return response;
    }
  }

  // OpenAPI endpoint (REST consumers)
  // Matches /api/* and /search for REST API routes
  if (url.pathname.startsWith("/api/") || url.pathname === "/search") {
    const response = await handleOpenAPI(request);
    if (response) {
      return response;
    }
  }

  // ==========================================================================
  // Health check (for backwards compatibility)
  // ==========================================================================

  if (url.pathname === "/health") {
    return new Response(
      JSON.stringify({
        status: "healthy",
        timestamp: new Date().toISOString(),
        service: "packrun-api",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // ==========================================================================
  // Not Found
  // ==========================================================================

  return new Response(
    JSON.stringify({
      error: "Not Found",
      path: url.pathname,
    }),
    {
      status: 404,
      headers: { "Content-Type": "application/json" },
    },
  );
}

// =============================================================================
// Server Startup
// =============================================================================

console.log(`packrun.dev API server starting on port ${PORT}...`);
console.log(`  Health:  http://localhost:${PORT}/health`);
console.log(`  MCP:     http://localhost:${PORT}/mcp`);
console.log(`  RPC:     http://localhost:${PORT}/rpc`);
console.log(`  REST:    http://localhost:${PORT}/api/package/:name`);
if (auth) {
  console.log(`  Auth:    http://localhost:${PORT}/api/auth/*`);
}

export default {
  port: PORT,
  fetch: handleRequest,
};

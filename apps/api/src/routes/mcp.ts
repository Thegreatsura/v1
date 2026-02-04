/**
 * MCP Route
 *
 * Model Context Protocol endpoint for stateless operation.
 * Creates fresh server + transport per request to avoid conflicts
 * when multiple clients connect simultaneously.
 */

import { Hono } from "hono";
import { StreamableHTTPTransport } from "@hono/mcp";
import { createMcpServer } from "../mcp/server";

export function createMcpRoutes() {
  const app = new Hono();

  app.all("/mcp", async (c) => {
    // Create fresh server and transport per request to avoid conflicts
    const mcpServer = createMcpServer();
    const transport = new StreamableHTTPTransport();

    await mcpServer.connect(transport);

    return transport.handleRequest(c);
  });

  return app;
}

import { McpStrategy, StdioTransport } from '@rekog/mcp-nest';

/**
 * STDIO variant of the MCP server. It shares every capability class with the
 * HTTP strategy, but has no request: `McpToolRunner` authenticates the caller
 * from `HEXA_MCP_API_KEY` on each tool call.
 *
 * Logging is disabled because stdout carries the MCP protocol; diagnostics go
 * to stderr from the entrypoint only.
 */
export const mcpStdioStrategy = new McpStrategy({
  name: process.env.MCP_SERVER_NAME?.trim() || 'hexa-dental',
  version: process.env.MCP_SERVER_VERSION?.trim() || '1.0.0',
  title: 'Hexa Dental (STDIO)',
  description: 'Dental quotations (presupuestos), patients and UCO fee catalog.',
  instructions:
    'This server manages dental quotations. Always search before creating. Never approve, reject or delete anything without explicit human confirmation. Do not invent prices: use the UCO catalog and the configured UCO rate. Patient data is sensitive.',
  transports: [new StdioTransport()],
  logging: false,
});

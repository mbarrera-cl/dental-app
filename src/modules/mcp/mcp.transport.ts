import { StreamableHttpTransport } from '@rekog/mcp-nest';

/**
 * Shared HTTP transport instance. `McpHttpControllerFor` binds to this exact
 * transport, which disables its self-mount and lets a normal Nest controller
 * (with the global auth guard) own the `/mcp` route.
 */
export const mcpHttpTransport = new StreamableHttpTransport();

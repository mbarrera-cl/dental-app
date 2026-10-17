import { McpStrategy } from '@rekog/mcp-nest';
import type { Principal } from '../../shared/security/principal.js';
import { mcpHttpTransport } from './mcp.transport.js';

const SERVER_NAME = process.env.MCP_SERVER_NAME?.trim() || 'hexa-dental';
const SERVER_VERSION = process.env.MCP_SERVER_VERSION?.trim() || '1.0.0';

/**
 * HTTP MCP strategy. It exposes the quotation tools over Streamable HTTP and
 * resolves the caller from the `Principal` the global auth guard attached to
 * the request (API key or JWT). The tools themselves enforce permissions via
 * `McpToolBase`, so the same checks work over STDIO where there is no request.
 */
export const mcpStrategy = new McpStrategy({
  name: SERVER_NAME,
  version: SERVER_VERSION,
  title: 'Hexa Dental',
  description: 'Dental quotations (presupuestos), patients and UCO fee catalog.',
  instructions:
    'This server manages dental quotations. Always search before creating. Never approve, reject or delete anything without explicit human confirmation. Do not invent prices: use the UCO catalog and the configured UCO rate. Patient data is sensitive.',
  transports: [mcpHttpTransport],
  resolveUser: (rawRequest) => {
    const principal = (rawRequest as { user?: Principal } | undefined)?.user;

    if (principal === undefined) {
      return undefined;
    }

    return {
      sub: principal.userId,
      name: principal.name,
      type: principal.type,
      apiKeyId: principal.apiKeyId,
      scope: [...principal.permissions].join(' '),
      scopes: [...principal.permissions],
      roles: principal.roles.map((role) => role.name),
    };
  },
});

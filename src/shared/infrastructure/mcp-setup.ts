import type { INestApplication } from '@nestjs/common';
import { mcpStrategy } from '../../modules/mcp/mcp.strategy.js';

export const MCP_ENABLED_ENV = 'MCP_ENABLED';

/** Whether the MCP transport should be mounted (opt-in per environment). */
export function isMcpEnabled(): boolean {
  return (process.env[MCP_ENABLED_ENV] ?? '').trim().toLowerCase() === 'true';
}

/**
 * Connects the MCP strategy to the HTTP adapter. Must run **before**
 * `app.listen()` so the transport handlers are mounted before the server
 * starts accepting requests.
 */
export async function configureMcp(app: INestApplication): Promise<void> {
  if (!isMcpEnabled()) {
    return;
  }

  mcpStrategy.setHttpAdapter(app.getHttpAdapter());
  app.connectMicroservice({ strategy: mcpStrategy });
  await app.startAllMicroservices();
}

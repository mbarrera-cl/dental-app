import { Ctx, Payload } from '@nestjs/microservices';
import { McpContext, McpController, Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { McpToolRunner } from '../base/mcp-tool-runner.js';

/**
 * Identity probe. It lets an MCP client discover which API key is connected
 * and which scopes it carries before attempting a domain tool.
 */
@McpController()
export class IdentityTools {
  constructor(private readonly runner: McpToolRunner) {}

  @Tool({
    name: 'hexa_whoami',
    description:
      'Return the connected API key owner, key type and effective permissions (scopes).',
    parameters: z.object({}),
  })
  async whoami(@Payload() args: Record<string, never>, @Ctx() ctx: McpContext) {
    return this.runner.run(ctx, { tool: 'hexa_whoami' }, args, async (actor) => ({
      userId: actor.userId,
      name: actor.name,
      type: actor.type,
      apiKeyId: actor.apiKeyId ?? null,
      roles: actor.roles.map((role) => role.name),
      permissions: [...actor.permissions].sort(),
    }));
  }
}

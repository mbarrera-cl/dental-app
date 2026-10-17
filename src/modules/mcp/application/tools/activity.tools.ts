import { Ctx, Payload } from '@nestjs/microservices';
import { McpContext, McpController, Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { McpToolRunner } from '../base/mcp-tool-runner.js';
import { ActivityFacade } from '../facades/activity.facade.js';

const listSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().describe('Maximum rows (capped by mcp.maxResults).'),
  module: z
    .string()
    .optional()
    .describe('Filter by module: auth, patients, clinical, quotes, uco, users, roles, settings, navigation, clinic, apikeys, mcp.'),
  outcome: z.enum(['success', 'failure']).optional(),
  from: z.string().optional().describe('ISO-8601 lower bound (inclusive).'),
  to: z.string().optional().describe('ISO-8601 upper bound (inclusive).'),
});

@McpController()
export class ActivityTools {
  constructor(
    private readonly runner: McpToolRunner,
    private readonly activity: ActivityFacade,
  ) {}

  @Tool({
    name: 'hexa_activity_list',
    description:
      'List the platform activity trail (who did what and when). Callers without activity:read-all only see their own actions.',
    parameters: listSchema,
  })
  async list(
    @Payload() args: z.infer<typeof listSchema>,
    @Ctx() ctx: McpContext,
  ) {
    return this.runner.run(
      ctx,
      {
        tool: 'hexa_activity_list',
        permissions: ['activity:read', 'activity:read-all'],
        match: 'any',
      },
      args,
      async (actor) => {
        const max = await this.runner.maxResults();

        return this.activity.list(
          {
            limit: Math.min(args.limit ?? max, max),
            module: args.module,
            outcome: args.outcome,
            from: args.from,
            to: args.to,
          },
          actor,
        );
      },
    );
  }
}

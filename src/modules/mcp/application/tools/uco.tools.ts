import { Ctx, Payload } from '@nestjs/microservices';
import { McpContext, McpController, Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { McpToolRunner } from '../base/mcp-tool-runner.js';
import { UcoFacade } from '../facades/uco.facade.js';

const searchSchema = z.object({
  query: z.string().default('').describe('Code, name or chapter to search in the UCO catalog.'),
  limit: z.number().int().min(1).max(100).optional().describe('Maximum rows (capped by mcp.maxResults).'),
});

const getSchema = z.object({
  code: z.string().min(1).describe('Exact UCO code (e.g. 010001).'),
});

@McpController()
export class UcoTools {
  constructor(
    private readonly runner: McpToolRunner,
    private readonly uco: UcoFacade,
  ) {}

  @Tool({
    name: 'hexa_uco_search',
    description:
      'Search the UCO dental fee catalog by code, name or chapter. Use it to pick procedures for a quotation.',
    parameters: searchSchema,
  })
  async search(
    @Payload() args: z.infer<typeof searchSchema>,
    @Ctx() ctx: McpContext,
  ) {
    return this.runner.run(
      ctx,
      { tool: 'hexa_uco_search', permissions: ['uco:read'] },
      args,
      async () => {
        const max = await this.runner.maxResults();
        const items = await this.uco.search(args.query, Math.min(args.limit ?? max, max));

        return { items };
      },
    );
  }

  @Tool({
    name: 'hexa_uco_get',
    description: 'Get one UCO procedure by its exact code (units and chapter).',
    parameters: getSchema,
  })
  async get(
    @Payload() args: z.infer<typeof getSchema>,
    @Ctx() ctx: McpContext,
  ) {
    return this.runner.run(
      ctx,
      { tool: 'hexa_uco_get', permissions: ['uco:read'] },
      args,
      async () => {
        const procedure = await this.uco.getByCode(args.code);

        return { procedure };
      },
    );
  }
}

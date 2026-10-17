import { Ctx, Payload } from '@nestjs/microservices';
import { McpContext, McpController, Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { McpToolRunner, type McpRunOptions } from '../base/mcp-tool-runner.js';
import {
  QuotesFacade,
  type CreateQuoteInput,
  type QuoteView,
  type UpdateQuoteInput,
} from '../facades/quotes.facade.js';

const itemSchema = z.object({
  ucoCode: z.string().max(16).optional().describe('UCO code. When set and unitPrice is omitted, the price is computed from the UCO rate.'),
  description: z.string().max(300).optional().describe('Line description; defaults to the UCO procedure name.'),
  piezaDental: z.string().max(32).optional().describe('Tooth or dental piece (e.g. 36).'),
  quantity: z.number().int().min(1).max(10000),
  unitPrice: z.number().int().min(0).max(1_000_000_000).optional().describe('CLP per unit. Omit when ucoCode is present.'),
  discountPercent: z.number().int().min(0).max(100).optional(),
});

const itemsSchema = z.array(itemSchema).min(1).max(100);

const listSchema = z.object({
  patientId: z.string().optional(),
  status: z.enum(['borrador', 'entregada', 'aprobada', 'rechazada']).optional(),
  q: z.string().optional().describe('Folio search term.'),
  from: z.string().optional().describe('ISO-8601 lower bound on createdAt.'),
  to: z.string().optional().describe('ISO-8601 upper bound on createdAt.'),
  deleted: z.enum(['exclude', 'only', 'all']).optional(),
  limit: z.number().int().min(1).max(100).optional().describe('Maximum rows (capped by mcp.maxResults).'),
});

const quoteIdSchema = z.object({ quoteId: z.string().min(1) });

const createSchema = z
  .object({
    patientId: z.string().optional(),
    patientRut: z.string().optional(),
    validUntil: z.string().nullable().optional().describe('ISO date; omit to use the configured validity.'),
    notes: z.string().max(2000).nullable().optional(),
    items: itemsSchema,
  })
  .refine((value) => Boolean(value.patientId) || Boolean(value.patientRut), {
    message: 'Provide patientId or patientRut.',
  });

const updateSchema = z.object({
  quoteId: z.string().min(1),
  validUntil: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  items: itemsSchema.describe('The full list of lines: the update replaces the current items.'),
});

const decideSchema = z.object({
  quoteId: z.string().min(1),
  itemId: z.string().min(1),
  status: z.enum(['generado', 'aprobado', 'rechazado']),
  confirm: z.boolean().optional().describe('Must be true after the human approves the change.'),
});

const sanctionSchema = z.object({
  quoteId: z.string().min(1),
  status: z.enum(['aprobada', 'rechazada']),
  confirm: z.boolean().optional().describe('Must be true after the human approves the change.'),
});

const confirmSchema = z.object({
  quoteId: z.string().min(1),
  confirm: z.boolean().optional().describe('Must be true after the human approves the change.'),
});

const quoteSubject: NonNullable<McpRunOptions['subject']> = (result) => {
  const quote = (result as { quote?: QuoteView }).quote;

  return quote === undefined ? null : { type: 'quote', id: quote.id, label: quote.folio };
};

@McpController()
export class QuotesTools {
  constructor(
    private readonly runner: McpToolRunner,
    private readonly quotes: QuotesFacade,
  ) {}

  @Tool({
    name: 'hexa_quotes_list',
    description: 'List quotations (presupuestos) with filters. Deleted quotes are hidden by default.',
    parameters: listSchema,
  })
  async list(
    @Payload() args: z.infer<typeof listSchema>,
    @Ctx() ctx: McpContext,
  ) {
    return this.runner.run(
      ctx,
      { tool: 'hexa_quotes_list', permissions: ['quotes:read'] },
      args,
      async () => {
        const max = await this.runner.maxResults();
        const items = await this.quotes.list({
          patientId: args.patientId,
          status: args.status,
          q: args.q,
          from: args.from,
          to: args.to,
          deleted: args.deleted,
          limit: Math.min(args.limit ?? max, max),
        });

        return { items };
      },
    );
  }

  @Tool({
    name: 'hexa_quotes_get',
    description: 'Get one quotation with its lines, totals and patient snapshot.',
    parameters: quoteIdSchema,
  })
  async get(
    @Payload() args: z.infer<typeof quoteIdSchema>,
    @Ctx() ctx: McpContext,
  ) {
    return this.runner.run(
      ctx,
      { tool: 'hexa_quotes_get', permissions: ['quotes:read'], subject: quoteSubject },
      args,
      async () => ({ quote: await this.quotes.get(args.quoteId) }),
    );
  }

  @Tool({
    name: 'hexa_quotes_versions',
    description: 'Version trail of a quotation (oldest first), including the stored snapshots.',
    parameters: quoteIdSchema,
  })
  async versions(
    @Payload() args: z.infer<typeof quoteIdSchema>,
    @Ctx() ctx: McpContext,
  ) {
    return this.runner.run(
      ctx,
      { tool: 'hexa_quotes_versions', permissions: ['quotes:read'] },
      args,
      async () => ({ versions: await this.quotes.listVersions(args.quoteId) }),
    );
  }

  @Tool({
    name: 'hexa_quotes_create',
    description:
      'Create a DRAFT quotation. Provide patientId or patientRut, and lines with ucoCode (price derived from the UCO rate) or an explicit unitPrice. Totals are always recomputed on the server.',
    parameters: createSchema,
  })
  async create(
    @Payload() args: z.infer<typeof createSchema>,
    @Ctx() ctx: McpContext,
  ) {
    const input: CreateQuoteInput = {
      patientId: args.patientId,
      patientRut: args.patientRut,
      validUntil: args.validUntil,
      notes: args.notes,
      items: args.items,
    };

    return this.runner.run(
      ctx,
      {
        tool: 'hexa_quotes_create',
        permissions: ['quotes:create'],
        write: true,
        subject: quoteSubject,
      },
      args,
      async (actor) => ({ quote: await this.quotes.create(input, actor) }),
    );
  }

  @Tool({
    name: 'hexa_quotes_update',
    description:
      'Replace the lines of a draft/entregada quotation and recompute totals. A sanctioned quotation is locked: duplicate it instead.',
    parameters: updateSchema,
  })
  async update(
    @Payload() args: z.infer<typeof updateSchema>,
    @Ctx() ctx: McpContext,
  ) {
    const input: UpdateQuoteInput = {
      quoteId: args.quoteId,
      validUntil: args.validUntil,
      notes: args.notes,
      items: args.items,
    };

    return this.runner.run(
      ctx,
      {
        tool: 'hexa_quotes_update',
        permissions: ['quotes:update'],
        write: true,
        subject: quoteSubject,
      },
      args,
      async (actor) => ({ quote: await this.quotes.update(input, actor) }),
    );
  }

  @Tool({
    name: 'hexa_quotes_duplicate',
    description: 'Duplicate a quotation as a new draft version (useful after it is sanctioned).',
    parameters: quoteIdSchema,
  })
  async duplicate(
    @Payload() args: z.infer<typeof quoteIdSchema>,
    @Ctx() ctx: McpContext,
  ) {
    return this.runner.run(
      ctx,
      {
        tool: 'hexa_quotes_duplicate',
        permissions: ['quotes:create'],
        write: true,
        subject: quoteSubject,
      },
      args,
      async (actor) => ({ quote: await this.quotes.duplicate(args.quoteId, actor) }),
    );
  }

  @Tool({
    name: 'hexa_quotes_decide_item',
    description:
      'Approve or reject one quotation line. SENSITIVE: ask the human first and call again with confirm: true.',
    parameters: decideSchema,
  })
  async decideItem(
    @Payload() args: z.infer<typeof decideSchema>,
    @Ctx() ctx: McpContext,
  ) {
    return this.runner.run(
      ctx,
      {
        tool: 'hexa_quotes_decide_item',
        permissions: ['quotes:update'],
        write: true,
        confirm: true,
        subject: quoteSubject,
      },
      args,
      async (actor) => ({
        quote: await this.quotes.decideItemStatus(args.quoteId, args.itemId, args.status, actor),
      }),
    );
  }

  @Tool({
    name: 'hexa_quotes_sanction',
    description:
      'Approve or reject a whole quotation. SENSITIVE: ask the human first and call again with confirm: true.',
    parameters: sanctionSchema,
  })
  async sanction(
    @Payload() args: z.infer<typeof sanctionSchema>,
    @Ctx() ctx: McpContext,
  ) {
    return this.runner.run(
      ctx,
      {
        tool: 'hexa_quotes_sanction',
        permissions: ['quotes:approve'],
        write: true,
        confirm: true,
        subject: quoteSubject,
      },
      args,
      async (actor) => ({ quote: await this.quotes.sanction(args.quoteId, args.status, actor) }),
    );
  }

  @Tool({
    name: 'hexa_quotes_delete',
    description:
      'Move a quotation to the trash (soft delete). SENSITIVE: ask the human first and call again with confirm: true.',
    parameters: confirmSchema,
  })
  async remove(
    @Payload() args: z.infer<typeof confirmSchema>,
    @Ctx() ctx: McpContext,
  ) {
    return this.runner.run(
      ctx,
      {
        tool: 'hexa_quotes_delete',
        permissions: ['quotes:delete'],
        write: true,
        confirm: true,
        subject: (result) => {
          const quoteId = (result as { quoteId?: string }).quoteId;

          return quoteId === undefined ? null : { type: 'quote', id: quoteId, label: null };
        },
      },
      args,
      async (actor) => {
        await this.quotes.remove(args.quoteId, actor);

        return { deleted: true, quoteId: args.quoteId };
      },
    );
  }

  @Tool({
    name: 'hexa_quotes_restore',
    description:
      'Restore a quotation from the trash. SENSITIVE: ask the human first and call again with confirm: true.',
    parameters: confirmSchema,
  })
  async restore(
    @Payload() args: z.infer<typeof confirmSchema>,
    @Ctx() ctx: McpContext,
  ) {
    return this.runner.run(
      ctx,
      {
        tool: 'hexa_quotes_restore',
        permissions: ['quotes:delete'],
        write: true,
        confirm: true,
        subject: quoteSubject,
      },
      args,
      async (actor) => ({ quote: await this.quotes.restore(args.quoteId, actor) }),
    );
  }
}

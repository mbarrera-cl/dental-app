import { Ctx, Payload } from '@nestjs/microservices';
import { McpContext, McpController, Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { McpToolRunner } from '../base/mcp-tool-runner.js';
import { PatientsFacade } from '../facades/patients.facade.js';

const searchSchema = z.object({
  query: z
    .string()
    .default('')
    .describe('RUT (any spelling) or part of the patient name. Empty lists the first patients.'),
  limit: z.number().int().min(1).max(100).optional().describe('Maximum rows (capped by mcp.maxResults).'),
});

const getSchema = z
  .object({
    patientId: z.string().optional().describe('Patient UUID.'),
    rut: z.string().optional().describe('Chilean RUT; the server normalizes it.'),
  })
  .refine((value) => Boolean(value.patientId) || Boolean(value.rut), {
    message: 'Provide patientId or rut.',
  });

@McpController()
export class PatientsTools {
  constructor(
    private readonly runner: McpToolRunner,
    private readonly patients: PatientsFacade,
  ) {}

  @Tool({
    name: 'hexa_patients_search',
    description:
      'Search patients by RUT or name. Returns identification fields only (no address or emergency contact).',
    parameters: searchSchema,
  })
  async search(
    @Payload() args: z.infer<typeof searchSchema>,
    @Ctx() ctx: McpContext,
  ) {
    return this.runner.run(
      ctx,
      { tool: 'hexa_patients_search', permissions: ['patients:read'] },
      args,
      async () => {
        const max = await this.runner.maxResults();
        const items = await this.patients.search(args.query, Math.min(args.limit ?? max, max));

        return { items };
      },
    );
  }

  @Tool({
    name: 'hexa_patients_get',
    description: 'Get one patient by id or RUT. Use it before creating a quotation.',
    parameters: getSchema,
  })
  async get(
    @Payload() args: z.infer<typeof getSchema>,
    @Ctx() ctx: McpContext,
  ) {
    return this.runner.run(
      ctx,
      { tool: 'hexa_patients_get', permissions: ['patients:read'] },
      args,
      async () => {
        const patient = await this.patients.resolve({
          patientId: args.patientId,
          rut: args.rut,
        });

        return { patient };
      },
    );
  }
}

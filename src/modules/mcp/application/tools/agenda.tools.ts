import { Ctx, Payload } from '@nestjs/microservices';
import { McpContext, McpController, Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { McpToolRunner, type McpRunOptions } from '../base/mcp-tool-runner.js';
import {
  AgendaFacade,
  type AgendaAppointmentView,
  type AgendaCreateInput,
  type AgendaUpdateInput,
} from '../facades/agenda.facade.js';

const statusSchema = z.enum(['scheduled', 'cancelled', 'completed', 'no_show']);

const rangeFields = {
  from: z
    .string()
    .optional()
    .describe(
      'ISO-8601 date (YYYY-MM-DD) or datetime. Defaults to the start of today in the clinic time zone.',
    ),
  to: z
    .string()
    .optional()
    .describe(
      'ISO-8601 date (YYYY-MM-DD) or datetime. A date includes the whole day; a datetime is an exclusive upper bound. Defaults to the end of today.',
    ),
};

const listSchema = z.object({
  ...rangeFields,
  status: z
    .array(statusSchema)
    .min(1)
    .max(4)
    .optional()
    .describe('Appointment statuses to include. Defaults to scheduled (patients with an appointment).'),
  professionalId: z.string().min(1).optional().describe('Filter by professional UUID.'),
  patientId: z.string().min(1).optional().describe('Filter by patient UUID.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum appointment rows (capped by mcp.maxResults).'),
});

const summarySchema = z.object({
  ...rangeFields,
  status: z
    .array(statusSchema)
    .min(1)
    .max(4)
    .optional()
    .describe('Appointment statuses to include. Defaults to every status.'),
  professionalId: z.string().min(1).optional().describe('Filter by professional UUID.'),
  patientId: z.string().min(1).optional().describe('Filter by patient UUID.'),
});

const createSchema = z
  .object({
    patientId: z
      .string()
      .min(1)
      .describe('Patient UUID. Resolve it first with hexa_patients_search.'),
    professionalId: z
      .string()
      .min(1)
      .describe('Professional UUID. Get it from hexa_agenda_summary.professionals.'),
    startsAt: z
      .string()
      .min(1)
      .describe('ISO-8601 datetime with time, e.g. 2026-10-23T10:00:00-03:00.'),
    durationMinutes: z
      .number()
      .int()
      .min(5)
      .max(720)
      .optional()
      .describe('Defaults to the configured agenda.defaultDurationMinutes.'),
    endsAt: z
      .string()
      .min(1)
      .optional()
      .describe('ISO-8601 datetime. Do not combine with durationMinutes.'),
    reason: z.string().max(2000).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    location: z.string().max(2000).nullable().optional(),
    confirm: z
      .boolean()
      .optional()
      .describe('Must be true after the human approves the appointment.'),
  })
  .refine((value) => value.endsAt === undefined || value.durationMinutes === undefined, {
    message: 'Provide endsAt or durationMinutes, not both.',
  });

const updateSchema = z
  .object({
    appointmentId: z.string().min(1),
    patientId: z.string().min(1).optional(),
    professionalId: z.string().min(1).optional(),
    startsAt: z.string().min(1).optional().describe('New ISO-8601 datetime.'),
    durationMinutes: z.number().int().min(5).max(720).optional(),
    endsAt: z.string().min(1).optional(),
    reason: z.string().max(2000).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    location: z.string().max(2000).nullable().optional(),
    confirm: z
      .boolean()
      .optional()
      .describe('Must be true after the human approves the change.'),
  })
  .refine((value) => value.endsAt === undefined || value.durationMinutes === undefined, {
    message: 'Provide endsAt or durationMinutes, not both.',
  })
  .refine(
    (value) =>
      value.patientId !== undefined ||
      value.professionalId !== undefined ||
      value.startsAt !== undefined ||
      value.durationMinutes !== undefined ||
      value.endsAt !== undefined ||
      value.reason !== undefined ||
      value.notes !== undefined ||
      value.location !== undefined,
    { message: 'Provide at least one field to update.' },
  );

const cancelSchema = z.object({
  appointmentId: z.string().min(1),
  confirm: z
    .boolean()
    .optional()
    .describe('Must be true after the human approves the cancellation.'),
});

const appointmentSubject: NonNullable<McpRunOptions['subject']> = (result) => {
  const appointment = (result as { appointment?: AgendaAppointmentView }).appointment;

  if (appointment === undefined) {
    return null;
  }

  return {
    type: 'appointment',
    id: appointment.id,
    label: `${appointment.patient.nombreCompleto} · ${appointment.date} ${appointment.time}`,
  };
};

@McpController()
export class AgendaTools {
  constructor(
    private readonly runner: McpToolRunner,
    private readonly agenda: AgendaFacade,
  ) {}

  @Tool({
    name: 'hexa_agenda_appointments',
    description:
      'Show the appointment calendar and the patients with an appointment. Returns clinic-local dates and times, patient RUT/email, professional and reason. Defaults to today and status scheduled.',
    parameters: listSchema,
  })
  async list(
    @Payload() args: z.infer<typeof listSchema>,
    @Ctx() ctx: McpContext,
  ) {
    return this.runner.run(
      ctx,
      { tool: 'hexa_agenda_appointments', permissions: ['agenda:read'] },
      args,
      async () => {
        const max = await this.runner.maxResults();

        return this.agenda.list({
          from: args.from,
          to: args.to,
          status: args.status ?? ['scheduled'],
          professionalId: args.professionalId,
          patientId: args.patientId,
          limit: Math.min(args.limit ?? max, max),
        });
      },
    );
  }

  @Tool({
    name: 'hexa_agenda_summary',
    description:
      'Aggregate the appointment calendar for a date range: totals by status, day, professional and reason, the next scheduled appointments and the active professionals directory. Use it to answer questions about the agenda.',
    parameters: summarySchema,
  })
  async summary(
    @Payload() args: z.infer<typeof summarySchema>,
    @Ctx() ctx: McpContext,
  ) {
    return this.runner.run(
      ctx,
      { tool: 'hexa_agenda_summary', permissions: ['agenda:read'] },
      args,
      async () =>
        this.agenda.summary({
          from: args.from,
          to: args.to,
          status: args.status,
          professionalId: args.professionalId,
          patientId: args.patientId,
        }),
    );
  }

  @Tool({
    name: 'hexa_agenda_create',
    description:
      'Create an appointment. Resolve patientId with hexa_patients_search and professionalId from hexa_agenda_summary.professionals. SENSITIVE: ask the human first and call again with confirm: true. The configured confirmation emails are queued.',
    parameters: createSchema,
  })
  async create(
    @Payload() args: z.infer<typeof createSchema>,
    @Ctx() ctx: McpContext,
  ) {
    const input: AgendaCreateInput = {
      patientId: args.patientId,
      professionalId: args.professionalId,
      startsAt: args.startsAt,
      durationMinutes: args.durationMinutes,
      endsAt: args.endsAt,
      reason: args.reason,
      notes: args.notes,
      location: args.location,
    };

    return this.runner.run(
      ctx,
      {
        tool: 'hexa_agenda_create',
        permissions: ['agenda:create'],
        write: true,
        confirm: true,
        subject: appointmentSubject,
      },
      args,
      async (actor) => this.agenda.create(input, actor),
    );
  }

  @Tool({
    name: 'hexa_agenda_update',
    description:
      'Reschedule or edit an appointment. If startsAt changes without endsAt or durationMinutes, the current duration is preserved. SENSITIVE: ask the human first and call again with confirm: true.',
    parameters: updateSchema,
  })
  async update(
    @Payload() args: z.infer<typeof updateSchema>,
    @Ctx() ctx: McpContext,
  ) {
    const input: AgendaUpdateInput = {
      appointmentId: args.appointmentId,
      patientId: args.patientId,
      professionalId: args.professionalId,
      startsAt: args.startsAt,
      durationMinutes: args.durationMinutes,
      endsAt: args.endsAt,
      reason: args.reason,
      notes: args.notes,
      location: args.location,
    };

    return this.runner.run(
      ctx,
      {
        tool: 'hexa_agenda_update',
        permissions: ['agenda:update'],
        write: true,
        confirm: true,
        subject: appointmentSubject,
      },
      args,
      async (actor) => this.agenda.update(input, actor),
    );
  }

  @Tool({
    name: 'hexa_agenda_cancel',
    description:
      'Cancel an appointment and queue the configured cancellation emails. SENSITIVE: ask the human first and call again with confirm: true.',
    parameters: cancelSchema,
  })
  async cancel(
    @Payload() args: z.infer<typeof cancelSchema>,
    @Ctx() ctx: McpContext,
  ) {
    return this.runner.run(
      ctx,
      {
        tool: 'hexa_agenda_cancel',
        permissions: ['agenda:cancel'],
        write: true,
        confirm: true,
        subject: appointmentSubject,
      },
      args,
      async (actor) => this.agenda.cancel(args.appointmentId, actor),
    );
  }
}

import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import type { Principal } from '../../../../shared/security/principal.js';
import { CancelAppointmentUseCase } from '../../../agenda/application/use-cases/cancel-appointment.use-case.js';
import { CreateAppointmentUseCase } from '../../../agenda/application/use-cases/create-appointment.use-case.js';
import { GetAgendaConfigUseCase } from '../../../agenda/application/use-cases/get-agenda-config.use-case.js';
import { GetAppointmentUseCase } from '../../../agenda/application/use-cases/get-appointment.use-case.js';
import { ListAppointmentsUseCase } from '../../../agenda/application/use-cases/list-appointments.use-case.js';
import { ListProfessionalsUseCase } from '../../../agenda/application/use-cases/list-professionals.use-case.js';
import { UpdateAppointmentUseCase } from '../../../agenda/application/use-cases/update-appointment.use-case.js';
import type { AppointmentStatus } from '../../../agenda/domain/appointment.entity.js';
import type {
  AppointmentConflict,
  AppointmentPatient,
  AppointmentProfessional,
  AppointmentView,
} from '../../../agenda/domain/appointment.models.js';

export interface AgendaRangeInput {
  from?: string;
  to?: string;
}

export interface AgendaFilterInput extends AgendaRangeInput {
  /** When omitted every status is included. */
  status?: AppointmentStatus[];
  professionalId?: string;
  patientId?: string;
}

export interface AgendaListInput extends AgendaFilterInput {
  limit: number;
}

export type AgendaSummaryInput = AgendaFilterInput;

export interface AgendaCreateInput {
  patientId: string;
  professionalId: string;
  startsAt: string;
  durationMinutes?: number;
  endsAt?: string;
  reason?: string | null;
  notes?: string | null;
  location?: string | null;
}

export interface AgendaUpdateInput {
  appointmentId: string;
  patientId?: string;
  professionalId?: string;
  startsAt?: string;
  durationMinutes?: number;
  endsAt?: string;
  reason?: string | null;
  notes?: string | null;
  location?: string | null;
}

export interface AgendaRangeView {
  /** ISO instant of the first included moment. */
  from: string;
  /** ISO instant of the last included moment. */
  to: string;
  timeZone: string;
  dateFrom: string;
  dateTo: string;
}

export interface AgendaPatientView {
  id: string;
  nombreCompleto: string;
  rut: string;
  email: string | null;
}

export interface AgendaPatientRollupView extends AgendaPatientView {
  appointments: number;
  nextAt: string | null;
}

export interface AgendaAppointmentView {
  id: string;
  startsAt: string;
  endsAt: string;
  date: string;
  time: string;
  endTime: string;
  weekday: string;
  status: AppointmentStatus;
  reason: string | null;
  location: string | null;
  patient: AgendaPatientView;
  professional: AppointmentProfessional;
}

export interface AgendaConflictView {
  id: string;
  startsAt: string;
  endsAt: string;
  patientName: string;
  professionalName: string;
}

export interface AgendaListResult {
  range: AgendaRangeView;
  total: number;
  returned: number;
  truncated: boolean;
  patientsTotal: number;
  patientsTruncated: boolean;
  appointments: AgendaAppointmentView[];
  patients: AgendaPatientRollupView[];
}

export interface AgendaStatusTotals {
  scheduled: number;
  cancelled: number;
  completed: number;
  no_show: number;
}

export interface AgendaDaySummary {
  date: string;
  weekday: string;
  appointments: number;
  scheduled: number;
  cancelled: number;
  completed: number;
  no_show: number;
  firstAt: string;
  lastAt: string;
}

export interface AgendaProfessionalSummary extends AppointmentProfessional {
  appointments: number;
  scheduled: number;
}

export interface AgendaReasonSummary {
  reason: string;
  appointments: number;
  scheduled: number;
}

export interface AgendaNextAppointment {
  id: string;
  startsAt: string;
  date: string;
  time: string;
  patientName: string;
  professionalName: string;
  reason: string | null;
}

export interface AgendaSummaryResult {
  range: AgendaRangeView;
  totals: {
    appointments: number;
    patients: number;
    byStatus: AgendaStatusTotals;
  };
  byDay: AgendaDaySummary[];
  byProfessional: AgendaProfessionalSummary[];
  byReason: AgendaReasonSummary[];
  next: AgendaNextAppointment[];
  professionals: AppointmentProfessional[];
}

export interface AgendaMutationResult {
  appointment: AgendaAppointmentView;
  warnings: AgendaConflictView[];
}

/**
 * MCP-facing agenda reads and writes. It reuses the existing agenda use cases
 * (domain validation, conflict warnings, confirmation emails) and only adds
 * the MCP conveniences: clinic time zone, compact views and aggregates.
 */
@Injectable()
export class AgendaFacade {
  constructor(
    private readonly listAppointments: ListAppointmentsUseCase,
    private readonly getAppointment: GetAppointmentUseCase,
    private readonly createAppointment: CreateAppointmentUseCase,
    private readonly updateAppointment: UpdateAppointmentUseCase,
    private readonly cancelAppointment: CancelAppointmentUseCase,
    private readonly listProfessionals: ListProfessionalsUseCase,
    private readonly config: GetAgendaConfigUseCase,
  ) {}

  async list(input: AgendaListInput, now: Date = new Date()): Promise<AgendaListResult> {
    const config = await this.config.execute();
    const { from, to, range } = resolveRange(input, config.timeZone, now);
    const views = await this.fetch(input, from, to);
    const page = views.slice(0, input.limit);
    const rolled = rollupPatients(views);

    return {
      range,
      total: views.length,
      returned: page.length,
      truncated: views.length > page.length,
      patientsTotal: rolled.length,
      patientsTruncated: rolled.length > input.limit,
      appointments: page.map((view) => toAppointmentView(view, config.timeZone)),
      patients: rolled.slice(0, input.limit),
    };
  }

  async summary(input: AgendaSummaryInput, now: Date = new Date()): Promise<AgendaSummaryResult> {
    const config = await this.config.execute();
    const { from, to, range } = resolveRange(input, config.timeZone, now);
    const [views, professionals] = await Promise.all([
      this.fetch(input, from, to),
      this.listProfessionals.execute(),
    ]);

    const byStatus: AgendaStatusTotals = {
      scheduled: 0,
      cancelled: 0,
      completed: 0,
      no_show: 0,
    };
    const patientIds = new Set<string>();
    const days = new Map<string, AgendaDaySummary>();
    const reasons = new Map<string, AgendaReasonSummary>();
    const professionalCounts = new Map<string, { appointments: number; scheduled: number }>();

    for (const view of views) {
      const appointment = view.appointment;
      const start = DateTime.fromJSDate(appointment.startsAt, { zone: config.timeZone });
      const date = start.toISODate() ?? '';
      const startsAt = appointment.startsAt.toISOString();

      byStatus[appointment.status] += 1;
      patientIds.add(view.patient.id);

      const day = days.get(date) ?? {
        date,
        weekday: start.setLocale('es').toFormat('cccc'),
        appointments: 0,
        scheduled: 0,
        cancelled: 0,
        completed: 0,
        no_show: 0,
        firstAt: startsAt,
        lastAt: startsAt,
      };
      day.appointments += 1;
      day[appointment.status] += 1;
      day.firstAt = startsAt < day.firstAt ? startsAt : day.firstAt;
      day.lastAt = startsAt > day.lastAt ? startsAt : day.lastAt;
      days.set(date, day);

      const reason = appointment.reason?.trim() || 'Sin motivo';
      const reasonEntry = reasons.get(reason) ?? { reason, appointments: 0, scheduled: 0 };
      reasonEntry.appointments += 1;
      if (appointment.status === 'scheduled') {
        reasonEntry.scheduled += 1;
      }
      reasons.set(reason, reasonEntry);

      const professional = professionalCounts.get(view.professional.id) ?? {
        appointments: 0,
        scheduled: 0,
      };
      professional.appointments += 1;
      if (appointment.status === 'scheduled') {
        professional.scheduled += 1;
      }
      professionalCounts.set(view.professional.id, professional);
    }

    const nowInstant = DateTime.fromJSDate(now, { zone: config.timeZone }).toMillis();
    const next = views
      .filter(
        (view) =>
          view.appointment.status === 'scheduled' &&
          view.appointment.startsAt.getTime() >= nowInstant,
      )
      .slice(0, 5)
      .map((view) => {
        const start = DateTime.fromJSDate(view.appointment.startsAt, { zone: config.timeZone });

        return {
          id: view.appointment.id,
          startsAt: view.appointment.startsAt.toISOString(),
          date: start.toISODate() ?? '',
          time: start.toFormat('HH:mm'),
          patientName: view.patient.nombreCompleto,
          professionalName: view.professional.name,
          reason: view.appointment.reason,
        };
      });

    return {
      range,
      totals: {
        appointments: views.length,
        patients: patientIds.size,
        byStatus,
      },
      byDay: [...days.values()].sort((left, right) => left.date.localeCompare(right.date)),
      byProfessional: professionals.map((professional) => ({
        ...professional,
        appointments: professionalCounts.get(professional.id)?.appointments ?? 0,
        scheduled: professionalCounts.get(professional.id)?.scheduled ?? 0,
      })),
      byReason: [...reasons.values()].sort(
        (left, right) =>
          right.appointments - left.appointments || left.reason.localeCompare(right.reason, 'es'),
      ),
      next,
      professionals,
    };
  }

  async get(appointmentId: string): Promise<AgendaAppointmentView> {
    const config = await this.config.execute();

    return toAppointmentView(await this.getAppointment.execute(appointmentId), config.timeZone);
  }

  async create(input: AgendaCreateInput, actor: Principal): Promise<AgendaMutationResult> {
    const config = await this.config.execute();
    const startsAt = parseInstant(input.startsAt, config.timeZone, 'startsAt');
    const durationMinutes = input.durationMinutes ?? config.defaultDurationMinutes;
    const endsAt =
      input.endsAt === undefined || input.endsAt === ''
        ? startsAt.plus({ minutes: durationMinutes })
        : parseInstant(input.endsAt, config.timeZone, 'endsAt');

    if (endsAt.toMillis() <= startsAt.toMillis()) {
      throw new Error('endsAt must be after startsAt.');
    }

    const result = await this.createAppointment.execute({
      patientId: input.patientId,
      professionalId: input.professionalId,
      startsAt: startsAt.toUTC().toISO() ?? input.startsAt,
      endsAt: endsAt.toUTC().toISO() ?? input.endsAt ?? '',
      reason: input.reason,
      notes: input.notes,
      location: input.location,
      actorId: actor.userId,
    });

    return {
      appointment: toAppointmentView(result.view, config.timeZone),
      warnings: result.warnings.map(toConflictView),
    };
  }

  async update(input: AgendaUpdateInput, actor: Principal): Promise<AgendaMutationResult> {
    const config = await this.config.execute();
    const current = await this.getAppointment.execute(input.appointmentId);
    const currentStart = DateTime.fromJSDate(current.appointment.startsAt, {
      zone: config.timeZone,
    });
    const currentEnd = DateTime.fromJSDate(current.appointment.endsAt, { zone: config.timeZone });
    const startsAt =
      input.startsAt === undefined || input.startsAt === ''
        ? currentStart
        : parseInstant(input.startsAt, config.timeZone, 'startsAt');

    let endsAt: DateTime | undefined;
    if (input.endsAt !== undefined && input.endsAt !== '') {
      endsAt = parseInstant(input.endsAt, config.timeZone, 'endsAt');
    } else if (input.durationMinutes !== undefined) {
      endsAt = startsAt.plus({ minutes: input.durationMinutes });
    } else if (input.startsAt !== undefined && input.startsAt !== '') {
      // Rescheduling without an explicit end keeps the current duration.
      endsAt = startsAt.plus({ milliseconds: currentEnd.toMillis() - currentStart.toMillis() });
    }

    if (endsAt !== undefined && endsAt.toMillis() <= startsAt.toMillis()) {
      throw new Error('endsAt must be after startsAt.');
    }

    const result = await this.updateAppointment.execute({
      id: input.appointmentId,
      patientId: input.patientId,
      professionalId: input.professionalId,
      startsAt:
        input.startsAt === undefined || input.startsAt === ''
          ? undefined
          : startsAt.toUTC().toISO() ?? input.startsAt,
      endsAt: endsAt?.toUTC().toISO() ?? undefined,
      reason: input.reason,
      notes: input.notes,
      location: input.location,
      actorId: actor.userId,
    });

    return {
      appointment: toAppointmentView(result.view, config.timeZone),
      warnings: result.warnings.map(toConflictView),
    };
  }

  async cancel(appointmentId: string, actor: Principal): Promise<AgendaMutationResult> {
    const config = await this.config.execute();
    const view = await this.cancelAppointment.execute({
      id: appointmentId,
      actorId: actor.userId,
    });

    return {
      appointment: toAppointmentView(view, config.timeZone),
      warnings: [],
    };
  }

  private async fetch(
    input: AgendaFilterInput,
    from: DateTime,
    to: DateTime,
  ): Promise<AppointmentView[]> {
    const views = await this.listAppointments.execute({
      from: from.toUTC().toISO() ?? from.toISO() ?? '',
      to: to.toUTC().toISO() ?? to.toISO() ?? '',
      professionalId: input.professionalId,
      patientId: input.patientId,
    });
    const statuses = input.status === undefined || input.status.length === 0
      ? null
      : new Set(input.status);

    return statuses === null
      ? views
      : views.filter((view) => statuses.has(view.appointment.status));
  }
}

interface ResolvedRange {
  from: DateTime;
  to: DateTime;
  range: AgendaRangeView;
}

function resolveRange(
  input: AgendaRangeInput,
  timeZone: string,
  now: Date,
): ResolvedRange {
  const today = DateTime.fromJSDate(now, { zone: timeZone }).startOf('day');
  const from =
    input.from === undefined || input.from.trim() === ''
      ? today
      : parseBoundary(input.from, timeZone, false);
  const to =
    input.to === undefined || input.to.trim() === ''
      ? today.plus({ days: 1 })
      : parseBoundary(input.to, timeZone, true);

  if (to.toMillis() <= from.toMillis()) {
    throw new Error('The agenda range must end after it starts.');
  }

  if (to.diff(from, 'days').days > 90) {
    throw new Error('The agenda range cannot exceed 90 days.');
  }

  return {
    from,
    to,
    range: {
      from: from.toUTC().toISO() ?? from.toISO() ?? '',
      to: to.minus({ milliseconds: 1 }).toUTC().toISO() ?? '',
      timeZone,
      dateFrom: from.setZone(timeZone).toISODate() ?? '',
      dateTo: to.minus({ milliseconds: 1 }).setZone(timeZone).toISODate() ?? '',
    },
  };
}

function parseBoundary(value: string, timeZone: string, endOfDay: boolean): DateTime {
  const trimmed = value.trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  const parsed = dateOnly
    ? DateTime.fromISO(trimmed, { zone: timeZone })
    : parseInstant(trimmed, timeZone, 'date');

  if (!parsed.isValid) {
    throw new Error(
      `Invalid date "${value}": ${parsed.invalidReason ?? 'expected ISO-8601 date or datetime'}.`,
    );
  }

  return dateOnly
    ? endOfDay
      ? parsed.plus({ days: 1 }).startOf('day')
      : parsed.startOf('day')
    : parsed;
}

function parseInstant(value: string, timeZone: string, field: string): DateTime {
  const trimmed = value.trim();

  if (!trimmed.includes('T')) {
    throw new Error(`Invalid ${field} "${value}": include a date and time in ISO-8601 format.`);
  }

  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  const parsed = hasOffset
    ? DateTime.fromISO(trimmed, { setZone: true }).setZone(timeZone)
    : DateTime.fromISO(trimmed, { zone: timeZone });

  if (!parsed.isValid) {
    throw new Error(
      `Invalid ${field} "${value}": ${parsed.invalidReason ?? 'expected ISO-8601'}.`,
    );
  }

  return parsed;
}

function toAppointmentView(view: AppointmentView, timeZone: string): AgendaAppointmentView {
  const start = DateTime.fromJSDate(view.appointment.startsAt, { zone: timeZone });
  const end = DateTime.fromJSDate(view.appointment.endsAt, { zone: timeZone });

  return {
    id: view.appointment.id,
    startsAt: view.appointment.startsAt.toISOString(),
    endsAt: view.appointment.endsAt.toISOString(),
    date: start.toISODate() ?? '',
    time: start.toFormat('HH:mm'),
    endTime: end.toFormat('HH:mm'),
    weekday: start.setLocale('es').toFormat('cccc'),
    status: view.appointment.status,
    reason: view.appointment.reason,
    location: view.appointment.location,
    patient: {
      id: view.patient.id,
      nombreCompleto: view.patient.nombreCompleto,
      rut: view.patient.rut,
      email: view.patient.email,
    },
    professional: {
      id: view.professional.id,
      name: view.professional.name,
      email: view.professional.email,
    },
  };
}

function toConflictView(conflict: AppointmentConflict): AgendaConflictView {
  return {
    id: conflict.id,
    startsAt: conflict.startsAt.toISOString(),
    endsAt: conflict.endsAt.toISOString(),
    patientName: conflict.patientName,
    professionalName: conflict.professionalName,
  };
}

function rollupPatients(views: AppointmentView[]): AgendaPatientRollupView[] {
  const patients = new Map<
    string,
    { patient: AppointmentPatient; appointments: number; nextAt: string | null }
  >();

  for (const view of views) {
    const scheduled = view.appointment.status === 'scheduled';
    const startsAt = scheduled ? view.appointment.startsAt.toISOString() : null;
    const current = patients.get(view.patient.id);

    if (current === undefined) {
      patients.set(view.patient.id, {
        patient: view.patient,
        appointments: 1,
        nextAt: startsAt,
      });
      continue;
    }

    current.appointments += 1;

    if (startsAt !== null && (current.nextAt === null || startsAt < current.nextAt)) {
      current.nextAt = startsAt;
    }
  }

  return [...patients.values()]
    .map(({ patient, appointments, nextAt }) => ({
      id: patient.id,
      nombreCompleto: patient.nombreCompleto,
      rut: patient.rut,
      email: patient.email,
      appointments,
      nextAt,
    }))
    .sort((left, right) => {
      if (left.nextAt !== null && right.nextAt !== null) {
        return left.nextAt.localeCompare(right.nextAt);
      }

      if (left.nextAt !== null) {
        return -1;
      }

      if (right.nextAt !== null) {
        return 1;
      }

      return left.nombreCompleto.localeCompare(right.nombreCompleto, 'es');
    });
}

import type { Principal } from '../../../../shared/security/principal.js';
import type { CancelAppointmentUseCase } from '../../../agenda/application/use-cases/cancel-appointment.use-case.js';
import type {
  CancelAppointmentCommand,
} from '../../../agenda/application/use-cases/cancel-appointment.use-case.js';
import type {
  CreateAppointmentCommand,
  CreateAppointmentUseCase,
} from '../../../agenda/application/use-cases/create-appointment.use-case.js';
import type { GetAgendaConfigUseCase } from '../../../agenda/application/use-cases/get-agenda-config.use-case.js';
import type { GetAppointmentUseCase } from '../../../agenda/application/use-cases/get-appointment.use-case.js';
import type { ListAppointmentsUseCase } from '../../../agenda/application/use-cases/list-appointments.use-case.js';
import type { ListProfessionalsUseCase } from '../../../agenda/application/use-cases/list-professionals.use-case.js';
import type {
  UpdateAppointmentCommand,
  UpdateAppointmentUseCase,
} from '../../../agenda/application/use-cases/update-appointment.use-case.js';
import {
  Appointment,
  type AppointmentStatus,
} from '../../../agenda/domain/appointment.entity.js';
import type { AppointmentView } from '../../../agenda/domain/appointment.models.js';
import { AgendaFacade } from './agenda.facade.js';

const actor: Principal = {
  type: 'user',
  userId: 'user-1',
  name: 'Ana',
  permissions: new Set(['agenda:read', 'agenda:create', 'agenda:update', 'agenda:cancel']),
  roles: [{ id: 'role-1', name: 'admin' }],
};

interface ViewOverrides {
  id?: string;
  patientId?: string;
  patientName?: string;
  professionalId?: string;
  professionalName?: string;
  startsAt?: string;
  endsAt?: string;
  status?: AppointmentStatus;
  reason?: string | null;
  location?: string | null;
}

function view(overrides: ViewOverrides = {}): AppointmentView {
  const id = overrides.id ?? 'a-1';
  const startsAt = new Date(overrides.startsAt ?? '2026-10-23T13:00:00.000Z');
  const endsAt = new Date(overrides.endsAt ?? '2026-10-23T13:30:00.000Z');
  const status = overrides.status ?? 'scheduled';

  return {
    appointment: Appointment.reconstitute(
      {
        patientId: overrides.patientId ?? 'patient-1',
        professionalId: overrides.professionalId ?? 'prof-1',
        startsAt,
        endsAt,
        status,
        reason: overrides.reason === undefined ? 'Control' : overrides.reason,
        notes: null,
        location: overrides.location === undefined ? 'Sede Centro' : overrides.location,
        icsSequence: 0,
        createdBy: 'user-1',
        updatedBy: 'user-1',
        createdAt: startsAt,
        updatedAt: startsAt,
        cancelledAt: status === 'cancelled' ? startsAt : null,
        cancelledBy: status === 'cancelled' ? 'user-1' : null,
      },
      id,
    ),
    patient: {
      id: overrides.patientId ?? 'patient-1',
      nombreCompleto: overrides.patientName ?? 'Camila Rojas',
      rut: '12.345.678-5',
      email: 'camila@example.com',
    },
    professional: {
      id: overrides.professionalId ?? 'prof-1',
      name: overrides.professionalName ?? 'Dra. Ana',
      email: 'ana@example.com',
    },
  };
}

function makeFacade(views: AppointmentView[]) {
  const listExecute = vi.fn(async () => views);
  const getExecute = vi.fn(async (id: string) => {
    const found = views.find((candidate) => candidate.appointment.id === id);

    if (found === undefined) {
      throw new Error(`Appointment ${id} not found`);
    }

    return found;
  });
  const createExecute = vi.fn(async (_command: CreateAppointmentCommand) => ({
    view: view({ id: 'a-new' }),
    warnings: [],
  }));
  const updateExecute = vi.fn(async (_command: UpdateAppointmentCommand) => ({
    view: view(),
    warnings: [],
  }));
  const cancelExecute = vi.fn(async (command: CancelAppointmentCommand) =>
    view({ id: command.id, status: 'cancelled' }),
  );
  const listProfessionals = {
    execute: vi.fn(async () => [
      { id: 'prof-1', name: 'Dra. Ana', email: 'ana@example.com' },
    ]),
  } as unknown as ListProfessionalsUseCase;
  const config = {
    execute: vi.fn(async () => ({
      timeZone: 'America/Santiago',
      defaultDurationMinutes: 30,
      notifyPatient: true,
      notifyProfessional: true,
    })),
  } as unknown as GetAgendaConfigUseCase;

  const facade = new AgendaFacade(
    { execute: listExecute } as unknown as ListAppointmentsUseCase,
    { execute: getExecute } as unknown as GetAppointmentUseCase,
    { execute: createExecute } as unknown as CreateAppointmentUseCase,
    { execute: updateExecute } as unknown as UpdateAppointmentUseCase,
    { execute: cancelExecute } as unknown as CancelAppointmentUseCase,
    listProfessionals,
    config,
  );

  return {
    facade,
    listExecute,
    getExecute,
    createExecute,
    updateExecute,
    cancelExecute,
  };
}

describe('AgendaFacade', () => {
  const now = new Date('2026-10-23T15:00:00.000Z');

  it('defaults to today in the clinic time zone and maps the patient view', async () => {
    const { facade, listExecute } = makeFacade([view()]);

    const result = await facade.list({ status: ['scheduled'], limit: 20 }, now);

    expect(listExecute).toHaveBeenCalledWith({
      from: '2026-10-23T03:00:00.000Z',
      to: '2026-10-24T03:00:00.000Z',
      professionalId: undefined,
      patientId: undefined,
    });
    expect(result.range).toMatchObject({
      timeZone: 'America/Santiago',
      dateFrom: '2026-10-23',
      dateTo: '2026-10-23',
    });
    expect(result.appointments[0]).toMatchObject({
      id: 'a-1',
      date: '2026-10-23',
      time: '10:00',
      endTime: '10:30',
      weekday: 'viernes',
      patient: { nombreCompleto: 'Camila Rojas', rut: '12.345.678-5' },
      professional: { name: 'Dra. Ana' },
    });
  });

  it('includes the whole day for a date-only upper bound and filters by status', async () => {
    const { facade, listExecute } = makeFacade([
      view({ id: 'scheduled', startsAt: '2026-10-22T13:00:00.000Z' }),
      view({ id: 'cancelled', startsAt: '2026-10-22T14:00:00.000Z', status: 'cancelled' }),
    ]);

    const result = await facade.list(
      { from: '2026-10-22', to: '2026-10-22', status: ['scheduled'], limit: 20 },
      now,
    );

    expect(listExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '2026-10-22T03:00:00.000Z',
        to: '2026-10-23T03:00:00.000Z',
      }),
    );
    expect(result.range.dateTo).toBe('2026-10-22');
    expect(result.total).toBe(1);
    expect(result.appointments[0]?.id).toBe('scheduled');
  });

  it('rolls up distinct patients and reports truncation', async () => {
    const { facade } = makeFacade([
      view({ id: 'a-1', patientId: 'patient-1', startsAt: '2026-10-23T13:00:00.000Z' }),
      view({ id: 'a-2', patientId: 'patient-1', startsAt: '2026-10-23T14:00:00.000Z' }),
      view({ id: 'a-3', patientId: 'patient-2', patientName: 'Otro Paciente' }),
    ]);

    const result = await facade.list({ status: ['scheduled'], limit: 2 }, now);

    expect(result).toMatchObject({
      total: 3,
      returned: 2,
      truncated: true,
      patientsTotal: 2,
      patientsTruncated: false,
    });
    expect(result.patients[0]).toMatchObject({
      id: 'patient-1',
      appointments: 2,
      nextAt: '2026-10-23T13:00:00.000Z',
    });
  });

  it('aggregates totals by status, day, professional and reason', async () => {
    const { facade } = makeFacade([
      view({ id: 'a-1', patientId: 'patient-1', startsAt: '2026-10-23T13:00:00.000Z' }),
      view({
        id: 'a-2',
        patientId: 'patient-2',
        patientName: 'Otro Paciente',
        startsAt: '2026-10-23T14:00:00.000Z',
      }),
      view({
        id: 'a-3',
        patientId: 'patient-1',
        startsAt: '2026-10-23T15:00:00.000Z',
        status: 'cancelled',
        reason: 'Urgencia',
      }),
      view({
        id: 'a-4',
        patientId: 'patient-3',
        patientName: 'Tercer Paciente',
        startsAt: '2026-10-24T13:00:00.000Z',
        reason: null,
      }),
    ]);

    const result = await facade.summary({}, new Date('2026-10-23T12:00:00.000Z'));

    expect(result.totals).toEqual({
      appointments: 4,
      patients: 3,
      byStatus: { scheduled: 3, cancelled: 1, completed: 0, no_show: 0 },
    });
    expect(result.byDay).toHaveLength(2);
    expect(result.byDay[0]).toMatchObject({
      date: '2026-10-23',
      appointments: 3,
      scheduled: 2,
      cancelled: 1,
    });
    expect(result.byProfessional[0]).toMatchObject({
      id: 'prof-1',
      appointments: 4,
      scheduled: 3,
    });
    expect(result.byReason).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'Control', appointments: 2 }),
        expect.objectContaining({ reason: 'Urgencia', appointments: 1 }),
        expect.objectContaining({ reason: 'Sin motivo', appointments: 1 }),
      ]),
    );
    expect(result.next.map((appointment) => appointment.id)).toEqual([
      'a-1',
      'a-2',
      'a-4',
    ]);
    expect(result.professionals).toHaveLength(1);
  });

  it('creates an appointment using the configured default duration', async () => {
    const { facade, createExecute } = makeFacade([]);

    await facade.create(
      {
        patientId: 'patient-1',
        professionalId: 'prof-1',
        startsAt: '2026-10-23T10:00:00-03:00',
        reason: 'Control',
      },
      actor,
    );

    expect(createExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-1',
        professionalId: 'prof-1',
        startsAt: '2026-10-23T13:00:00.000Z',
        endsAt: '2026-10-23T13:30:00.000Z',
        reason: 'Control',
        actorId: 'user-1',
      }),
    );
  });

  it('keeps the current duration when only startsAt changes', async () => {
    const { facade, updateExecute } = makeFacade([view()]);

    await facade.update(
      { appointmentId: 'a-1', startsAt: '2026-10-23T14:00:00.000Z' },
      actor,
    );

    expect(updateExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'a-1',
        startsAt: '2026-10-23T14:00:00.000Z',
        endsAt: '2026-10-23T14:30:00.000Z',
        actorId: 'user-1',
      }),
    );
  });

  it('applies an explicit duration without moving the start', async () => {
    const { facade, updateExecute } = makeFacade([view()]);

    await facade.update({ appointmentId: 'a-1', durationMinutes: 45 }, actor);

    expect(updateExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'a-1',
        startsAt: undefined,
        endsAt: '2026-10-23T13:45:00.000Z',
      }),
    );
  });

  it('cancels an appointment', async () => {
    const { facade, cancelExecute } = makeFacade([view()]);

    const result = await facade.cancel('a-1', actor);

    expect(cancelExecute).toHaveBeenCalledWith({ id: 'a-1', actorId: 'user-1' });
    expect(result.appointment.status).toBe('cancelled');
  });

  it('rejects ranges longer than 90 days and date-only start times', async () => {
    const { facade } = makeFacade([]);

    await expect(
      facade.list(
        { from: '2026-01-01', to: '2026-05-01', status: ['scheduled'], limit: 20 },
        now,
      ),
    ).rejects.toThrow('90 days');

    await expect(
      facade.create(
        {
          patientId: 'patient-1',
          professionalId: 'prof-1',
          startsAt: '2026-10-23',
        },
        actor,
      ),
    ).rejects.toThrow('include a date and time');
  });
});

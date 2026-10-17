import { Appointment } from './appointment.entity.js';
import { InvalidAppointmentRangeError } from './appointment.errors.js';

const BASE = {
  patientId: 'patient-1',
  professionalId: 'professional-1',
  startsAt: new Date('2026-10-20T14:00:00.000Z'),
  endsAt: new Date('2026-10-20T14:30:00.000Z'),
  now: new Date('2026-10-17T12:00:00.000Z'),
};

describe('Appointment', () => {
  it('creates a scheduled appointment with sequence zero', () => {
    const appointment = Appointment.create(BASE);

    expect(appointment.status).toBe('scheduled');
    expect(appointment.icsSequence).toBe(0);
    expect(appointment.reason).toBeNull();
  });

  it('rejects a range whose end is not after the start', () => {
    expect(() =>
      Appointment.create({ ...BASE, startsAt: BASE.endsAt, endsAt: BASE.startsAt }),
    ).toThrow(InvalidAppointmentRangeError);
  });

  it('rejects appointments longer than twelve hours', () => {
    expect(() =>
      Appointment.create({
        ...BASE,
        endsAt: new Date('2026-10-21T03:00:01.000Z'),
      }),
    ).toThrow(InvalidAppointmentRangeError);
  });

  it('increments the ICS sequence when rescheduled', () => {
    const appointment = Appointment.create(BASE);
    const startsAt = new Date('2026-10-20T15:00:00.000Z');
    const endsAt = new Date('2026-10-20T15:30:00.000Z');

    appointment.update({ startsAt, endsAt, actorId: 'user-1' });

    expect(appointment.startsAt).toEqual(startsAt);
    expect(appointment.icsSequence).toBe(1);
    expect(appointment.updatedBy).toBe('user-1');
  });

  it('cancels an appointment and increments the sequence', () => {
    const appointment = Appointment.create(BASE);
    const cancelledAt = new Date('2026-10-18T12:00:00.000Z');

    appointment.cancel('user-1', cancelledAt);

    expect(appointment.status).toBe('cancelled');
    expect(appointment.cancelledAt).toEqual(cancelledAt);
    expect(appointment.cancelledBy).toBe('user-1');
    expect(appointment.icsSequence).toBe(1);
  });
});

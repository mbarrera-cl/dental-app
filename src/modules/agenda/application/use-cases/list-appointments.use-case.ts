import { Injectable } from '@nestjs/common';
import { AppointmentRepositoryPort } from '../ports/appointment-repository.port.js';
import { InvalidAppointmentRangeError } from '../../domain/appointment.errors.js';
import type { AppointmentView } from '../../domain/appointment.models.js';

export interface ListAppointmentsQuery {
  from: string;
  to: string;
  professionalId?: string;
  patientId?: string;
}

@Injectable()
export class ListAppointmentsUseCase {
  constructor(private readonly appointments: AppointmentRepositoryPort) {}

  async execute(query: ListAppointmentsQuery): Promise<AppointmentView[]> {
    const from = new Date(query.from);
    const to = new Date(query.to);

    if (to.getTime() - from.getTime() > 90 * 24 * 60 * 60 * 1000) {
      throw new InvalidAppointmentRangeError('calendar range cannot exceed 90 days');
    }

    return this.appointments.list({
      from,
      to,
      professionalId: query.professionalId,
      patientId: query.patientId,
    });
  }
}

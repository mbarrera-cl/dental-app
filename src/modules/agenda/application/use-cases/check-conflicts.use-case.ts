import { Injectable } from '@nestjs/common';
import { AppointmentRepositoryPort } from '../ports/appointment-repository.port.js';
import type { AppointmentConflict } from '../../domain/appointment.models.js';

export interface CheckConflictsQuery {
  professionalId: string;
  startsAt: string;
  endsAt: string;
  excludeId?: string;
}

@Injectable()
export class CheckConflictsUseCase {
  constructor(private readonly appointments: AppointmentRepositoryPort) {}

  execute(query: CheckConflictsQuery): Promise<AppointmentConflict[]> {
    return this.appointments.findConflicts(
      query.professionalId,
      new Date(query.startsAt),
      new Date(query.endsAt),
      query.excludeId,
    );
  }
}

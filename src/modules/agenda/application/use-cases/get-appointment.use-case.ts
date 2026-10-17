import { Injectable } from '@nestjs/common';
import { AppointmentRepositoryPort } from '../ports/appointment-repository.port.js';
import { AppointmentNotFoundError } from '../../domain/appointment.errors.js';
import type { AppointmentView } from '../../domain/appointment.models.js';

@Injectable()
export class GetAppointmentUseCase {
  constructor(private readonly appointments: AppointmentRepositoryPort) {}

  async execute(id: string): Promise<AppointmentView> {
    const view = await this.appointments.findById(id);

    if (view === null) {
      throw new AppointmentNotFoundError(id);
    }

    return view;
  }
}

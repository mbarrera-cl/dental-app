import { Injectable } from '@nestjs/common';
import { AppointmentRepositoryPort } from '../ports/appointment-repository.port.js';
import { AgendaEmailService } from '../services/agenda-email.service.js';
import { AppointmentNotFoundError } from '../../domain/appointment.errors.js';
import type { AppointmentView } from '../../domain/appointment.models.js';

export interface CancelAppointmentCommand {
  id: string;
  actorId: string;
}

@Injectable()
export class CancelAppointmentUseCase {
  constructor(
    private readonly appointments: AppointmentRepositoryPort,
    private readonly emails: AgendaEmailService,
  ) {}

  async execute(command: CancelAppointmentCommand): Promise<AppointmentView> {
    const appointment = await this.appointments.findEntityById(command.id);

    if (appointment === null) {
      throw new AppointmentNotFoundError(command.id);
    }

    const alreadyCancelled = appointment.status === 'cancelled';
    appointment.cancel(command.actorId);
    await this.appointments.update(appointment);
    const view = await this.appointments.findById(appointment.id);

    if (view === null) {
      throw new AppointmentNotFoundError(appointment.id);
    }

    if (!alreadyCancelled) {
      await this.emails.queue(view, 'cancelled');
    }

    return view;
  }
}

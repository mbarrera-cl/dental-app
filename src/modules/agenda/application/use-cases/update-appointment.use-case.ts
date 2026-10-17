import { Injectable } from '@nestjs/common';
import { AppointmentRepositoryPort } from '../ports/appointment-repository.port.js';
import { AgendaEmailService } from '../services/agenda-email.service.js';
import {
  AgendaPatientNotFoundError,
  AgendaProfessionalNotFoundError,
  AppointmentNotFoundError,
} from '../../domain/appointment.errors.js';
import type { AppointmentConflict } from '../../domain/appointment.models.js';
import type { AppointmentResult } from './create-appointment.use-case.js';

export interface UpdateAppointmentCommand {
  id: string;
  patientId?: string;
  professionalId?: string;
  startsAt?: string;
  endsAt?: string;
  reason?: string | null;
  notes?: string | null;
  location?: string | null;
  actorId: string;
}

@Injectable()
export class UpdateAppointmentUseCase {
  constructor(
    private readonly appointments: AppointmentRepositoryPort,
    private readonly emails: AgendaEmailService,
  ) {}

  async execute(command: UpdateAppointmentCommand): Promise<AppointmentResult> {
    const appointment = await this.appointments.findEntityById(command.id);

    if (appointment === null) {
      throw new AppointmentNotFoundError(command.id);
    }

    const patientId = command.patientId ?? appointment.patientId;
    const professionalId = command.professionalId ?? appointment.professionalId;
    const [patient, professional] = await Promise.all([
      this.appointments.findPatient(patientId),
      this.appointments.findProfessional(professionalId),
    ]);

    if (patient === null) {
      throw new AgendaPatientNotFoundError(patientId);
    }

    if (professional === null) {
      throw new AgendaProfessionalNotFoundError(professionalId);
    }

    appointment.update({
      patientId,
      professionalId,
      startsAt: command.startsAt === undefined ? undefined : new Date(command.startsAt),
      endsAt: command.endsAt === undefined ? undefined : new Date(command.endsAt),
      reason: command.reason,
      notes: command.notes,
      location: command.location,
      actorId: command.actorId,
    });

    const warnings: AppointmentConflict[] = await this.appointments.findConflicts(
      professionalId,
      appointment.startsAt,
      appointment.endsAt,
      appointment.id,
    );

    await this.appointments.update(appointment);
    const view = await this.appointments.findById(appointment.id);

    if (view === null) {
      throw new AppointmentNotFoundError(appointment.id);
    }

    await this.emails.queue(view, 'updated');

    return { view, warnings };
  }
}

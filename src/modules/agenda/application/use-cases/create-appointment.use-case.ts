import { Injectable } from '@nestjs/common';
import { AppointmentRepositoryPort } from '../ports/appointment-repository.port.js';
import { AgendaEmailService } from '../services/agenda-email.service.js';
import { Appointment } from '../../domain/appointment.entity.js';
import {
  AgendaPatientNotFoundError,
  AgendaProfessionalNotFoundError,
} from '../../domain/appointment.errors.js';
import type { AppointmentConflict, AppointmentView } from '../../domain/appointment.models.js';

export interface CreateAppointmentCommand {
  patientId: string;
  professionalId: string;
  startsAt: string;
  endsAt: string;
  reason?: string | null;
  notes?: string | null;
  location?: string | null;
  actorId: string;
}

export interface AppointmentResult {
  view: AppointmentView;
  warnings: AppointmentConflict[];
}

@Injectable()
export class CreateAppointmentUseCase {
  constructor(
    private readonly appointments: AppointmentRepositoryPort,
    private readonly emails: AgendaEmailService,
  ) {}

  async execute(command: CreateAppointmentCommand): Promise<AppointmentResult> {
    const [patient, professional] = await Promise.all([
      this.appointments.findPatient(command.patientId),
      this.appointments.findProfessional(command.professionalId),
    ]);

    if (patient === null) {
      throw new AgendaPatientNotFoundError(command.patientId);
    }

    if (professional === null) {
      throw new AgendaProfessionalNotFoundError(command.professionalId);
    }

    const appointment = Appointment.create({
      patientId: command.patientId,
      professionalId: command.professionalId,
      startsAt: new Date(command.startsAt),
      endsAt: new Date(command.endsAt),
      reason: command.reason,
      notes: command.notes,
      location: command.location,
      createdBy: command.actorId,
    });

    const warnings = await this.appointments.findConflicts(
      command.professionalId,
      appointment.startsAt,
      appointment.endsAt,
    );

    await this.appointments.save(appointment);
    const view = await this.appointments.findById(appointment.id);

    if (view === null) {
      throw new Error('The appointment could not be read after creation');
    }

    await this.emails.queue(view, 'created');

    return { view, warnings };
  }
}

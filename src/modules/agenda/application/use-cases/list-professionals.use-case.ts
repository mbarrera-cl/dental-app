import { Injectable } from '@nestjs/common';
import { AppointmentRepositoryPort } from '../ports/appointment-repository.port.js';
import type { AppointmentProfessional } from '../../domain/appointment.models.js';

@Injectable()
export class ListProfessionalsUseCase {
  constructor(private readonly appointments: AppointmentRepositoryPort) {}

  execute(): Promise<AppointmentProfessional[]> {
    return this.appointments.listProfessionals();
  }
}

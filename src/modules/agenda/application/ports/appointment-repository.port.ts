import type { Appointment } from '../../domain/appointment.entity.js';
import type {
  AppointmentConflict,
  AppointmentPatient,
  AppointmentProfessional,
  AppointmentView,
} from '../../domain/appointment.models.js';

export interface AppointmentRange {
  from: Date;
  to: Date;
  professionalId?: string;
  patientId?: string;
}

export abstract class AppointmentRepositoryPort {
  abstract save(appointment: Appointment): Promise<void>;

  abstract update(appointment: Appointment): Promise<void>;

  abstract findById(id: string): Promise<AppointmentView | null>;

  abstract findEntityById(id: string): Promise<Appointment | null>;

  abstract list(range: AppointmentRange): Promise<AppointmentView[]>;

  abstract findConflicts(
    professionalId: string,
    startsAt: Date,
    endsAt: Date,
    excludeId?: string | null,
  ): Promise<AppointmentConflict[]>;

  abstract findPatient(id: string): Promise<AppointmentPatient | null>;

  abstract searchPatients(query: string): Promise<AppointmentPatient[]>;

  abstract findProfessional(id: string): Promise<AppointmentProfessional | null>;

  abstract listProfessionals(): Promise<AppointmentProfessional[]>;
}

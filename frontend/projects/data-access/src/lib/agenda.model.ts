export type AppointmentStatus = 'scheduled' | 'cancelled' | 'completed' | 'no_show';

export interface AgendaPatient {
  id: string;
  nombreCompleto: string;
  rut: string;
  email: string | null;
}

export interface AgendaProfessional {
  id: string;
  name: string;
  email: string;
}

export interface AppointmentConflict {
  id: string;
  startsAt: string;
  endsAt: string;
  patientName: string;
  professionalName: string;
}

export interface Appointment {
  id: string;
  patient: AgendaPatient;
  professional: AgendaProfessional;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  reason: string | null;
  notes: string | null;
  location: string | null;
  icsSequence: number;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  warnings: AppointmentConflict[];
}

export interface AgendaConfig {
  timeZone: string;
  defaultDurationMinutes: number;
  notifyPatient: boolean;
  notifyProfessional: boolean;
}

export interface CreateAppointmentPayload {
  patientId: string;
  professionalId: string;
  startsAt: string;
  endsAt: string;
  reason?: string | null;
  notes?: string | null;
  location?: string | null;
}

export type UpdateAppointmentPayload = Partial<CreateAppointmentPayload>;

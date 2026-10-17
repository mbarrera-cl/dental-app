import type { Appointment } from './appointment.entity.js';

export interface AppointmentPatient {
  id: string;
  nombreCompleto: string;
  rut: string;
  email: string | null;
}

export interface AppointmentProfessional {
  id: string;
  name: string;
  email: string;
}

export interface AppointmentView {
  appointment: Appointment;
  patient: AppointmentPatient;
  professional: AppointmentProfessional;
}

export interface AppointmentConflict {
  id: string;
  startsAt: Date;
  endsAt: Date;
  patientName: string;
  professionalName: string;
}

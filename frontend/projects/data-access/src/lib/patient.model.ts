import type { RegionCode } from './region';

export type PatientSexo = 'femenino' | 'masculino' | 'otro';

export type PrevisionTipo = 'FONASA' | 'ISAPRE';

export type FonasaTramo = 'A' | 'B' | 'C' | 'D';

export interface Direccion {
  region: RegionCode;
  comuna: string;
  calle: string;
  numero: string;
  departamento: string | null;
}

export interface Prevision {
  tipo: PrevisionTipo;
  /** FONASA only. */
  tramo: FonasaTramo | null;
  /** ISAPRE only. */
  plan: string | null;
}

export interface ContactoEmergencia {
  nombre: string;
  telefono: string;
  parentesco: string | null;
}

/**
 * Domain model shared by the remotes. Mirrors the JSON returned by the
 * backend (`patient-response.dto.ts`). The RUT is the business key, in its
 * canonical form (`12345678-5`); use `formatRut` for display.
 */
export interface Patient {
  id: string;
  /** Canonical RUT: body without dots, uppercase check digit. */
  rut: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  /** Timezone-free `YYYY-MM-DD`. */
  fechaNacimiento: string;
  sexo: PatientSexo;
  email: string | null;
  /** Canonical `+56912345678`. */
  telefono: string | null;
  direccion: Direccion | null;
  prevision: Prevision | null;
  contactoEmergencia: ContactoEmergencia | null;
  notas: string | null;
  /** Sequential clinical record number (`HC-000123`), assigned on creation. */
  numeroHistoria: string;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

/** Payload accepted by `POST /patients` (mirrors the backend validation rules). */
export interface CreatePatientPayload {
  rut: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento: string;
  sexo: PatientSexo;
  email?: string | null;
  telefono?: string | null;
  direccion?: Direccion | null;
  prevision?: Prevision | null;
  contactoEmergencia?: ContactoEmergencia | null;
  notas?: string | null;
}

/**
 * Payload accepted by `PATCH /patients/:id`. Omitting a field leaves it
 * untouched; sending `null` on the optional groups clears them.
 */
export type UpdatePatientPayload = Partial<CreatePatientPayload>;

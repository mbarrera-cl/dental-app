/** One prescribed medication, as returned by the prescriptions API. */
export interface PrescriptionItem {
  medicamento: string;
  dosis: string;
  frecuencia: string;
  duracion: string;
}

/** Mirrors the JSON returned by `prescription-response.dto.ts`. */
export interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  patientRut: string;
  items: PrescriptionItem[];
  indicaciones: string | null;
  issuedBy: string | null;
  issuedByName: string;
  /** ISO-8601 timestamp. */
  issuedAt: string;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

export interface CreatePrescriptionPayload {
  items: PrescriptionItem[];
  indicaciones?: string | null;
}

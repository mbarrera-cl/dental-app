/** Reusable informed-consent text (versioned by the backend). */
export interface ConsentTemplate {
  id: string;
  key: string;
  title: string;
  body: string;
  version: number;
  active: boolean;
  /** ISO-8601 timestamp. */
  createdAt: string;
  /** ISO-8601 timestamp. */
  updatedAt: string;
}

/** Append-only acceptance of a template by a patient. */
export interface ConsentRecord {
  id: string;
  patientId: string;
  patientName: string;
  patientRut: string;
  templateId: string | null;
  templateKey: string;
  templateVersion: number;
  title: string;
  body: string;
  procedure: string | null;
  acceptorName: string;
  /** ISO-8601 timestamp. */
  acceptedAt: string;
  recordedBy: string | null;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

export interface RecordConsentPayload {
  templateKey: string;
  procedure?: string | null;
  acceptorName: string;
}

export interface UpsertConsentTemplatePayload {
  key: string;
  title: string;
  body: string;
  active?: boolean;
}

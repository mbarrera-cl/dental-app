import type { Patient } from '../../domain/patient.entity.js';

export interface PatientExportOptions {
  readonly patients: readonly Patient[];
  /** IANA zone used for the generated-at timestamps and the filename date. */
  readonly timeZone: string;
  readonly generatedAt: Date;
}

/** Builds an XLSX workbook for the given patients. */
export abstract class PatientExportPort {
  abstract build(options: PatientExportOptions): Promise<Buffer>;
}

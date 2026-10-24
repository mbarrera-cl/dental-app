import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { formatRut } from '../../../../shared/domain/rut-format.js';
import { SettingsService } from '../../../settings/application/settings.service.js';
import type { Patient } from '../../domain/patient.entity.js';
import { PatientExportPort } from '../ports/patient-export.port.js';
import { PatientRepositoryPort } from '../ports/patient-repository.port.js';

export interface ExportPatientsCommand {
  /** Optional search term, matching the list page filter. */
  readonly q?: string;
}

export interface PatientExportFile {
  readonly buffer: Buffer;
  readonly filename: string;
}

const DEFAULT_TIME_ZONE = 'America/Santiago';

@Injectable()
export class ExportPatientsUseCase {
  constructor(
    private readonly patientRepository: PatientRepositoryPort,
    private readonly patientExport: PatientExportPort,
    private readonly settings: SettingsService,
  ) {}

  async execute({ q }: ExportPatientsCommand = {}): Promise<PatientExportFile> {
    const [patients, timeZoneValue] = await Promise.all([
      this.patientRepository.findAll(),
      this.settings.getValue('clinic.timeZone'),
    ]);
    const timeZone = resolveTimeZone(timeZoneValue);
    const generatedAt = new Date();
    const buffer = await this.patientExport.build({
      patients: filterPatients(patients, q),
      timeZone,
      generatedAt,
    });
    const date =
      DateTime.fromJSDate(generatedAt, { zone: timeZone }).toISODate() ??
      generatedAt.toISOString().slice(0, 10);

    return { buffer, filename: `pacientes-${date}.xlsx` };
  }
}

/**
 * Same matching rules as the patients list: names, email, canonical RUT and
 * RUT digits. The result is sorted by last name so the spreadsheet is useful
 * even when the list page is ordered by creation date.
 */
export function filterPatients(patients: readonly Patient[], q?: string): Patient[] {
  const query = q?.trim().toLowerCase() ?? '';
  const collator = new Intl.Collator('es-CL', { sensitivity: 'base' });
  const filtered = query === '' ? [...patients] : patients.filter((patient) => matches(patient, query));

  return filtered.sort(
    (left, right) =>
      collator.compare(left.apellidoPaterno, right.apellidoPaterno) ||
      collator.compare(left.apellidoMaterno, right.apellidoMaterno) ||
      collator.compare(left.nombres, right.nombres),
  );
}

function matches(patient: Patient, query: string): boolean {
  const haystack = [
    patient.nombres,
    patient.apellidoPaterno,
    patient.apellidoMaterno,
    patient.email ?? '',
    patient.rut,
    formatRut(patient.rut),
  ]
    .join(' ')
    .toLowerCase();

  if (haystack.includes(query)) {
    return true;
  }

  const digits = query.replace(/[^0-9k]/g, '');

  return digits !== '' && haystack.replace(/[^0-9k]/g, '').includes(digits);
}

function resolveTimeZone(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    return DEFAULT_TIME_ZONE;
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return value;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

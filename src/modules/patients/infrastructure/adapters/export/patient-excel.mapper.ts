import { DateTime } from 'luxon';
import type { Cell, Row, SheetData } from 'write-excel-file/node';
import { formatRut } from '../../../../../shared/domain/rut-format.js';
import type { Patient } from '../../../domain/patient.entity.js';

export interface PatientExportColumn {
  readonly header: string;
  readonly width: number;
}

/**
 * Column order and widths of the patients workbook. Keeping it in one place
 * makes the header row and the width list impossible to drift apart.
 */
export const PATIENT_EXPORT_COLUMNS: readonly PatientExportColumn[] = [
  { header: 'N° HC', width: 12 },
  { header: 'RUT', width: 14 },
  { header: 'Nombres', width: 20 },
  { header: 'Apellido paterno', width: 20 },
  { header: 'Apellido materno', width: 20 },
  { header: 'Fecha de nacimiento', width: 16 },
  { header: 'Edad', width: 8 },
  { header: 'Sexo', width: 12 },
  { header: 'Email', width: 28 },
  { header: 'Teléfono', width: 18 },
  { header: 'Región', width: 8 },
  { header: 'Comuna', width: 18 },
  { header: 'Calle', width: 24 },
  { header: 'Número', width: 10 },
  { header: 'Departamento', width: 14 },
  { header: 'Previsión', width: 22 },
  { header: 'Contacto de emergencia', width: 24 },
  { header: 'Teléfono de emergencia', width: 20 },
  { header: 'Parentesco', width: 14 },
  { header: 'Notas', width: 40 },
  { header: 'Fecha de registro', width: 18 },
];

const HEADER_STYLE = {
  fontWeight: 'bold' as const,
  backgroundColor: '#E2E8F0',
  textColor: '#0F172A',
  align: 'left' as const,
  borderColor: '#CBD5E1',
  borderStyle: 'thin' as const,
};

/** Text cell; optionally force Excel's text format (RUTs, phone numbers). */
function text(value: string | null | undefined, forceText = false): Cell {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return {
    value,
    type: String,
    ...(forceText ? { format: '@' } : {}),
  };
}

function number(value: number | null): Cell {
  return value === null ? null : { value, type: Number };
}

function formatDateOnly(isoDate: string): string {
  const date = DateTime.fromISO(isoDate, { zone: 'utc' });

  return date.isValid ? date.toFormat('dd/MM/yyyy') : isoDate;
}

function formatDateTime(date: Date, timeZone: string): string {
  const value = DateTime.fromJSDate(date, { zone: timeZone });

  return value.isValid ? value.toFormat('dd/MM/yyyy HH:mm') : date.toISOString();
}

function ageAt(fechaNacimiento: string, generatedAt: Date, timeZone: string): number | null {
  const today = DateTime.fromJSDate(generatedAt, { zone: timeZone }).startOf('day');
  const birth = DateTime.fromISO(fechaNacimiento, { zone: timeZone }).startOf('day');

  if (!today.isValid || !birth.isValid || birth > today) {
    return null;
  }

  return Math.floor(today.diff(birth, 'years').years);
}

function sexoLabel(sexo: Patient['sexo']): string {
  switch (sexo) {
    case 'femenino':
      return 'Femenino';
    case 'masculino':
      return 'Masculino';
    default:
      return 'Otro';
  }
}

function previsionLabel(patient: Patient): string {
  const prevision = patient.prevision;

  if (prevision === null) {
    return '';
  }

  switch (prevision.tipo) {
    case 'FONASA':
      return prevision.tramo === null ? 'FONASA' : `FONASA · ${prevision.tramo}`;
    case 'ISAPRE':
      return prevision.plan === null ? 'ISAPRE' : `ISAPRE · ${prevision.plan}`;
    case 'CONVENIO':
      return prevision.convenio === null ? 'CONVENIO' : `CONVENIO · ${prevision.convenio}`;
    default:
      return 'PARTICULAR';
  }
}

export function patientToRow(
  patient: Patient,
  timeZone: string,
  generatedAt: Date,
): Row {
  const direccion = patient.direccion;
  const contacto = patient.contactoEmergencia;

  return [
    text(patient.numeroHistoria),
    text(formatRut(patient.rut), true),
    text(patient.nombres),
    text(patient.apellidoPaterno),
    text(patient.apellidoMaterno),
    text(formatDateOnly(patient.fechaNacimiento)),
    number(ageAt(patient.fechaNacimiento, generatedAt, timeZone)),
    text(sexoLabel(patient.sexo)),
    text(patient.email),
    text(patient.telefono, true),
    text(direccion?.region),
    text(direccion?.comuna),
    text(direccion?.calle),
    text(direccion?.numero),
    text(direccion?.departamento),
    text(previsionLabel(patient)),
    text(contacto?.nombre),
    text(contacto?.telefono, true),
    text(contacto?.parentesco),
    text(patient.notas),
    text(formatDateTime(patient.createdAt, timeZone)),
  ];
}

export function buildPatientSheet(
  patients: readonly Patient[],
  timeZone: string,
  generatedAt: Date,
): SheetData {
  const header: Row = PATIENT_EXPORT_COLUMNS.map((column) => ({
    value: column.header,
    ...HEADER_STYLE,
  }));

  return [header, ...patients.map((patient) => patientToRow(patient, timeZone, generatedAt))];
}

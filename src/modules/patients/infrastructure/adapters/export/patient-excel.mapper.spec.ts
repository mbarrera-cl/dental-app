import type { Cell } from 'write-excel-file/node';
import { Patient } from '../../../domain/patient.entity.js';
import {
  PATIENT_EXPORT_COLUMNS,
  buildPatientSheet,
  patientToRow,
} from './patient-excel.mapper.js';

const GENERATED_AT = new Date('2026-10-24T12:00:00.000Z');

function fullPatient(): Patient {
  return Patient.create({
    rut: '12.345.678-5',
    nombres: 'Camila',
    apellidoPaterno: 'Rojas',
    apellidoMaterno: 'Pérez',
    fechaNacimiento: '1990-05-17',
    sexo: 'femenino',
    email: 'camila@example.com',
    telefono: '+56 9 1234 5678',
    direccion: {
      region: 'RM',
      comuna: 'Providencia',
      calle: 'Av. Providencia',
      numero: '1234',
      departamento: 'Depto 51',
    },
    prevision: { tipo: 'FONASA', tramo: 'B' },
    contactoEmergencia: {
      nombre: 'María Pérez',
      telefono: '9 8765 4321',
      parentesco: 'Madre',
    },
    notas: 'Alergia a la penicilina',
    numeroHistoria: 'HC-000001',
  });
}

function minimalPatient(): Patient {
  return Patient.create({
    rut: '22.222.222-2',
    nombres: 'Grace',
    apellidoPaterno: 'Soto',
    apellidoMaterno: 'Muñoz',
    fechaNacimiento: '1985-11-02',
    sexo: 'femenino',
    numeroHistoria: 'HC-000002',
  });
}

function cellValue(cell: Cell | undefined): unknown {
  if (cell === null || cell === undefined) {
    return null;
  }

  if (typeof cell === 'object' && 'value' in cell) {
    return (cell as { value?: unknown }).value;
  }

  return cell;
}

describe('patient Excel mapper', () => {
  it('uses one header cell per column and styles the header row', () => {
    const sheet = buildPatientSheet([fullPatient()], 'America/Santiago', GENERATED_AT);
    const header = sheet[0] ?? [];

    expect(header).toHaveLength(PATIENT_EXPORT_COLUMNS.length);
    expect(header.map((cell) => cellValue(cell))).toEqual(
      PATIENT_EXPORT_COLUMNS.map((column) => column.header),
    );
    expect(header[0]).toMatchObject({ fontWeight: 'bold', backgroundColor: '#E2E8F0' });
  });

  it('maps every patient field, the display RUT and the coverage label', () => {
    const row = patientToRow(fullPatient(), 'America/Santiago', GENERATED_AT);

    expect(row.map((cell) => cellValue(cell))).toEqual([
      'HC-000001',
      '12.345.678-5',
      'Camila',
      'Rojas',
      'Pérez',
      '17/05/1990',
      36,
      'Femenino',
      'camila@example.com',
      '+56912345678',
      'RM',
      'Providencia',
      'Av. Providencia',
      '1234',
      'Depto 51',
      'FONASA · B',
      'María Pérez',
      '+56987654321',
      'Madre',
      'Alergia a la penicilina',
      expect.stringMatching(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/),
    ]);
  });

  it('leaves optional fields blank and keeps the name-based row shape', () => {
    const row = patientToRow(minimalPatient(), 'America/Santiago', GENERATED_AT);

    expect(row).toHaveLength(PATIENT_EXPORT_COLUMNS.length);
    expect(row.map((cell) => cellValue(cell))).toEqual([
      'HC-000002',
      '22.222.222-2',
      'Grace',
      'Soto',
      'Muñoz',
      '02/11/1985',
      40,
      'Femenino',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      expect.stringMatching(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/),
    ]);
  });

  it('keeps RUT and phone cells as text to preserve dots and the plus sign', () => {
    const row = patientToRow(fullPatient(), 'America/Santiago', GENERATED_AT);

    expect(row[1]).toMatchObject({ type: String, format: '@' });
    expect(row[9]).toMatchObject({ type: String, format: '@' });
    expect(row[17]).toMatchObject({ type: String, format: '@' });
  });
});

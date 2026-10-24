import { Patient } from '../../../domain/patient.entity.js';
import { WriteExcelFilePatientExportAdapter } from './write-excel-file-patient-export.adapter.js';

const PATIENT = Patient.create({
  rut: '12.345.678-5',
  nombres: 'Camila',
  apellidoPaterno: 'Rojas',
  apellidoMaterno: 'Pérez',
  fechaNacimiento: '1990-05-17',
  sexo: 'femenino',
  email: 'camila@example.com',
  numeroHistoria: 'HC-000001',
});

describe('WriteExcelFilePatientExportAdapter', () => {
  it('builds a non-empty XLSX (ZIP) buffer', async () => {
    const buffer = await new WriteExcelFilePatientExportAdapter().build({
      patients: [PATIENT],
      timeZone: 'America/Santiago',
      generatedAt: new Date('2026-10-24T12:00:00.000Z'),
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1_000);
    expect(buffer.subarray(0, 2).toString('utf8')).toBe('PK');
  });
});

import type { SettingsService } from '../../../settings/application/settings.service.js';
import { Patient } from '../../domain/patient.entity.js';
import type { PatientExportOptions, PatientExportPort } from '../ports/patient-export.port.js';
import type { PatientRepositoryPort } from '../ports/patient-repository.port.js';
import { ExportPatientsUseCase, filterPatients } from './export-patients.use-case.js';

function patient(
  rut: string,
  nombres: string,
  apellidoPaterno: string,
  apellidoMaterno: string,
): Patient {
  return Patient.create({
    rut,
    nombres,
    apellidoPaterno,
    apellidoMaterno,
    fechaNacimiento: '1990-05-17',
    sexo: 'femenino',
    email: `${nombres.toLowerCase()}@example.com`,
    numeroHistoria: `HC-${rut.replace(/\D/g, '').slice(0, 6).padStart(6, '0')}`,
  });
}

const CAMILA = patient('12.345.678-5', 'Camila', 'Rojas', 'Pérez');
const GRACE = patient('22.222.222-2', 'Grace', 'Soto', 'Muñoz');
const ANA = patient('11.111.111-1', 'Ana', 'Pérez', 'Díaz');

function builtOptions(build: ReturnType<typeof vi.fn>): PatientExportOptions {
  const call = build.mock.calls[0];

  if (call === undefined) {
    throw new Error('The exporter was not called');
  }

  return call[0] as PatientExportOptions;
}

describe('ExportPatientsUseCase', () => {
  let build: ReturnType<typeof vi.fn>;
  let findAll: ReturnType<typeof vi.fn>;
  let getValue: ReturnType<typeof vi.fn>;
  let useCase: ExportPatientsUseCase;

  beforeEach(() => {
    build = vi.fn(async (_options: PatientExportOptions) => Buffer.from('PK'));
    findAll = vi.fn(async () => [CAMILA, GRACE, ANA]);
    getValue = vi.fn(async () => 'America/Santiago');

    useCase = new ExportPatientsUseCase(
      { findAll } as unknown as PatientRepositoryPort,
      { build } as unknown as PatientExportPort,
      { getValue } as unknown as SettingsService,
    );
  });

  it('sorts the workbook by last name and uses the clinic time zone', async () => {
    await useCase.execute();

    const options = builtOptions(build);

    expect(options.patients.map((item) => item.nombres)).toEqual(['Ana', 'Camila', 'Grace']);
    expect(options.timeZone).toBe('America/Santiago');
    expect(getValue).toHaveBeenCalledWith('clinic.timeZone');
  });

  it('filters by name, email or RUT digits before building the file', async () => {
    await useCase.execute({ q: 'grace' });
    expect(builtOptions(build).patients).toEqual([GRACE]);

    build.mockClear();
    await useCase.execute({ q: '22.222.222' });
    expect(builtOptions(build).patients).toEqual([GRACE]);

    build.mockClear();
    await useCase.execute({ q: 'ana@example.com' });
    expect(builtOptions(build).patients).toEqual([ANA]);
  });

  it('returns the generated filename with the clinic-local date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-24T15:00:00.000Z'));

    try {
      const file = await useCase.execute();

      expect(file.filename).toBe('pacientes-2026-10-24.xlsx');
      expect(file.buffer.toString()).toBe('PK');
    } finally {
      vi.useRealTimers();
    }
  });

  it('falls back to America/Santiago when the setting is not a valid zone', async () => {
    getValue.mockResolvedValueOnce('Not/AZone');

    await useCase.execute();

    expect(builtOptions(build).timeZone).toBe('America/Santiago');
  });

  it('accepts an empty patient list', async () => {
    findAll.mockResolvedValueOnce([]);

    await useCase.execute();

    expect(builtOptions(build).patients).toEqual([]);
  });
});

describe('filterPatients', () => {
  it('matches the formatted RUT and the canonical RUT', () => {
    expect(filterPatients([CAMILA, GRACE], '12.345.678-5')).toEqual([CAMILA]);
    expect(filterPatients([CAMILA, GRACE], '123456785')).toEqual([CAMILA]);
  });
});

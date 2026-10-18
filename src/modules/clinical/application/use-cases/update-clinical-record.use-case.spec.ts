import { Patient } from '../../../patients/domain/patient.entity.js';
import { InMemoryPatientRepository } from '../../../patients/infrastructure/adapters/persistence/in-memory-patient.repository.js';
import { Antecedentes } from '../../domain/antecedentes.vo.js';
import {
  ClinicalRecordLockedError,
  EmptyClinicalRecordUpdateError,
} from '../../domain/clinical.errors.js';
import { ExamenEstomatognatico } from '../../domain/examen-estomatognatico.vo.js';
import {
  FichaClinica,
  type FichaClinicaProps,
} from '../../domain/ficha-clinica.entity.js';
import { IndicadoresSaludBucal } from '../../domain/indicadores.vo.js';
import { SignosVitales } from '../../domain/signos-vitales.vo.js';
import { InMemoryClinicalRecordRepository } from '../../infrastructure/adapters/persistence/in-memory-clinical-record.repository.js';
import { CreateClinicalRecordUseCase } from './create-clinical-record.use-case.js';
import { UpdateClinicalRecordUseCase } from './update-clinical-record.use-case.js';

describe('UpdateClinicalRecordUseCase', () => {
  const setup = async () => {
    const patients = new InMemoryPatientRepository();
    const records = new InMemoryClinicalRecordRepository();
    const patient = Patient.create({
      rut: '12.345.678-5',
      nombres: 'Camila',
      apellidoPaterno: 'Rojas',
      apellidoMaterno: 'Pérez',
      fechaNacimiento: '1990-05-17',
      sexo: 'femenino',
      numeroHistoria: 'HC-000001',
    });

    await patients.save(patient);

    const record = await new CreateClinicalRecordUseCase(records, patients).execute({
      patientId: patient.id,
      actorId: 'user-1',
    });

    return {
      records,
      patient,
      record,
      useCase: new UpdateClinicalRecordUseCase(records),
    };
  };

  it('applies partial updates (sections, vitals, indicators) and audits the actor', async () => {
    const { useCase, record } = await setup();

    const updated = await useCase.execute({
      id: record.id,
      actorId: 'user-2',
      motivoConsulta: 'Dolor en pieza 16',
      embarazada: true,
      signosVitales: {
        presionArterialSistolica: 120,
        presionArterialDiastolica: 80,
        temperatura: 36.5,
      },
      antecedentes: { asma: { present: true, notes: 'Inhalador a mano' } },
      examenEstomatognatico: {
        regiones: { labios: 'alterado' },
        descripcion: '2 (mejillas): leve descamación',
      },
      indicadores: {
        higieneOral: { '16': { placa: 2, calculo: 1, gingivitis: 1 } },
        maloclusion: 'angle-i',
      },
    });

    expect(updated.motivoConsulta).toBe('Dolor en pieza 16');
    expect(updated.embarazada).toBe(true);
    expect(updated.signosVitales.presionArterialSistolica).toBe(120);
    expect(updated.signosVitales.temperatura).toBe(36.5);
    expect(updated.antecedentes.get('asma')).toEqual({
      present: true,
      notes: 'Inhalador a mano',
    });
    expect(updated.examenEstomatognatico.regiones['labios']).toBe('alterado');
    expect(updated.indicadores.maloclusion).toBe('angle-i');
    expect(updated.indicadores.higieneOral.get(16).placa).toBe(2);
    expect(updated.updatedBy).toBe('user-2');
  });

  it('clears nullable sections with null', async () => {
    const { useCase, record } = await setup();

    await useCase.execute({ id: record.id, actorId: 'user-2', motivoConsulta: 'x' });
    const cleared = await useCase.execute({
      id: record.id,
      actorId: 'user-2',
      motivoConsulta: null,
      antecedentes: null,
    });

    expect(cleared.motivoConsulta).toBeNull();
    expect(cleared.antecedentes.get('asma')).toEqual({
      present: false,
      notes: null,
    });
  });

  it('rejects an empty update', async () => {
    const { useCase, record } = await setup();

    await expect(
      useCase.execute({ id: record.id, actorId: 'user-2' }),
    ).rejects.toBeInstanceOf(EmptyClinicalRecordUpdateError);
  });

  it('rejects edits on a finalized record', async () => {
    const { records, useCase } = await setup();
    const props: FichaClinicaProps = {
      patientId: 'patient-locked',
      categoria: 'mayor-20',
      embarazada: false,
      motivoConsulta: null,
      enfermedadActual: null,
      antecedentes: Antecedentes.create(null),
      signosVitales: SignosVitales.create(),
      examenEstomatognatico: ExamenEstomatognatico.create(),
      indicadores: IndicadoresSaludBucal.create(),
      status: 'finalizada',
      createdBy: 'user-1',
      updatedBy: 'user-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      finalizedAt: new Date('2026-01-02T00:00:00.000Z'),
      finalizedBy: 'user-1',
      integrityHash: null,
    };
    const locked = FichaClinica.reconstitute(props, 'record-locked');

    await records.save(locked);

    await expect(
      useCase.execute({ id: 'record-locked', actorId: 'user-2', motivoConsulta: 'x' }),
    ).rejects.toBeInstanceOf(ClinicalRecordLockedError);
  });
});

import { Antecedentes } from './antecedentes.vo.js';
import { ClinicalRecordLockedError } from './clinical.errors.js';
import { ExamenEstomatognatico } from './examen-estomatognatico.vo.js';
import {
  FichaClinica,
  type FichaClinicaProps,
} from './ficha-clinica.entity.js';
import { IndicadoresSaludBucal } from './indicadores.vo.js';
import { SignosVitales } from './signos-vitales.vo.js';

describe('FichaClinica', () => {
  const createDraft = () =>
    FichaClinica.create({
      patientId: 'patient-1',
      categoria: '5-9-programado',
      createdBy: 'user-1',
    });

  it('starts as a draft with empty sections', () => {
    const record = createDraft();

    expect(record.status).toBe('borrador');
    expect(record.isDraft).toBe(true);
    expect(record.embarazada).toBe(false);
    expect(record.motivoConsulta).toBeNull();
    expect(record.antecedentes.get('asma')).toEqual({
      present: false,
      notes: null,
    });
    expect(record.signosVitales.presionArterialSistolica).toBeNull();
    expect(record.examenEstomatognatico.descripcion).toBeNull();
    expect(record.indicadores.maloclusion).toBeNull();
    expect(record.createdBy).toBe('user-1');
  });

  it('validates the category and text limits', () => {
    expect(() =>
      FichaClinica.create({
        patientId: 'patient-1',
        categoria: 'adulto',
        createdBy: null,
      }),
    ).toThrow(expect.objectContaining({ name: 'InvalidCategoriaEtariaError' }));

    const record = createDraft();

    expect(() => record.changeMotivoConsulta('x'.repeat(1001))).toThrow(
      expect.objectContaining({ name: 'InvalidFichaClinicaError' }),
    );
  });

  it('mutates sections and touches the audit trail', () => {
    const record = createDraft();
    const when = new Date('2026-10-16T15:00:00.000Z');

    record.changeMotivoConsulta('  Dolor en pieza 16  ');
    record.changeAntecedentes(
      Antecedentes.create({ asma: { present: true, notes: ' Inhalador ' } }),
    );
    record.touch('user-2', when);

    expect(record.motivoConsulta).toBe('Dolor en pieza 16');
    expect(record.antecedentes.get('asma')).toEqual({
      present: true,
      notes: 'Inhalador',
    });
    expect(record.updatedBy).toBe('user-2');
    expect(record.updatedAt).toEqual(when);
  });

  it('locks every mutator once the record is finalized', () => {
    const props: FichaClinicaProps = {
      patientId: 'patient-1',
      categoria: '15-19',
      embarazada: false,
      motivoConsulta: 'Control',
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
    };
    const locked = FichaClinica.reconstitute(props, 'record-1');

    expect(locked.isDraft).toBe(false);
    expect(() => locked.changeMotivoConsulta('nuevo')).toThrow(
      ClinicalRecordLockedError,
    );
    expect(() => locked.changeEmbarazada(true)).toThrow(
      ClinicalRecordLockedError,
    );
  });
});

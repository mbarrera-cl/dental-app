import { Patient } from '../../../patients/domain/patient.entity.js';
import { InMemoryPatientRepository } from '../../../patients/infrastructure/adapters/persistence/in-memory-patient.repository.js';
import { ClinicalRecordLockedError } from '../../domain/clinical.errors.js';
import { InMemoryClinicalRecordRepository } from '../../infrastructure/adapters/persistence/in-memory-clinical-record.repository.js';
import { InMemoryTreatmentPlanRepository } from '../../infrastructure/adapters/persistence/in-memory-treatment-plan.repository.js';
import { AddTreatmentPlanItemUseCase } from './add-treatment-plan-item.use-case.js';
import { CreateClinicalRecordUseCase } from './create-clinical-record.use-case.js';
import { FinalizeClinicalRecordUseCase } from './finalize-clinical-record.use-case.js';
import { GetTreatmentPlanUseCase } from './get-treatment-plan.use-case.js';
import { UpdateTreatmentPlanItemUseCase } from './update-treatment-plan-item.use-case.js';

describe('Treatment plan use cases', () => {
  const setup = async () => {
    const patients = new InMemoryPatientRepository();
    const records = new InMemoryClinicalRecordRepository();
    const plans = new InMemoryTreatmentPlanRepository();
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

    const record = await new CreateClinicalRecordUseCase(
      records,
      patients,
    ).execute({
      patientId: patient.id,
      actorId: 'user-1',
    });

    return {
      records,
      record,
      getPlan: new GetTreatmentPlanUseCase(records, plans),
      addItem: new AddTreatmentPlanItemUseCase(records, plans),
      updateItem: new UpdateTreatmentPlanItemUseCase(records, plans),
    };
  };

  it('creates the plan lazily and lists items in order', async () => {
    const { record, addItem, getPlan } = await setup();

    const first = await addItem.execute({
      recordId: record.id,
      actorId: 'user-1',
      tooth: 36,
      procedure: 'Endodoncia pieza 36',
    });
    const second = await addItem.execute({
      recordId: record.id,
      actorId: 'user-1',
      procedure: 'Limpieza general',
    });

    expect(first.position).toBe(0);
    expect(second.position).toBe(1);
    expect(second.tooth).toBeNull();

    const view = await getPlan.execute({ recordId: record.id });
    expect(view.items).toHaveLength(2);
    expect(view.items.map((item) => item.procedure)).toEqual([
      'Endodoncia pieza 36',
      'Limpieza general',
    ]);
  });

  it('advances the status and audits the timeline event', async () => {
    const { records, record, addItem, updateItem } = await setup();

    const item = await addItem.execute({
      recordId: record.id,
      actorId: 'user-1',
      tooth: 36,
      procedure: 'Endodoncia pieza 36',
    });

    const updated = await updateItem.execute({
      itemId: item.id,
      actorId: 'user-1',
      status: 'realizado',
    });

    expect(updated.status).toBe('realizado');
    expect(updated.statusChangedBy).toBe('user-1');

    const events = await records.listEvents(record.id);
    expect(events.map((event) => event.action)).toContain(
      'plan-item-actualizado',
    );
  });

  it('rejects updates on a finalized record', async () => {
    const { records, record, addItem, updateItem } = await setup();

    const item = await addItem.execute({
      recordId: record.id,
      actorId: 'user-1',
      tooth: 36,
      procedure: 'Endodoncia pieza 36',
    });

    // Lock the record via the finalize use case path.
    await new FinalizeClinicalRecordUseCase(records).execute({
      id: record.id,
      actorId: 'user-1',
    });

    await expect(
      addItem.execute({
        recordId: record.id,
        actorId: 'user-1',
        tooth: 46,
        procedure: 'Corona pieza 46',
      }),
    ).rejects.toBeInstanceOf(ClinicalRecordLockedError);

    await expect(
      updateItem.execute({
        itemId: item.id,
        actorId: 'user-1',
        status: 'realizado',
      }),
    ).rejects.toBeInstanceOf(ClinicalRecordLockedError);
  });

  it('rejects an empty item update', async () => {
    const { record, addItem, updateItem } = await setup();

    const item = await addItem.execute({
      recordId: record.id,
      actorId: 'user-1',
      procedure: 'Limpieza',
    });

    await expect(
      updateItem.execute({ itemId: item.id, actorId: 'user-1' }),
    ).rejects.toMatchObject({ name: 'EmptyTreatmentPlanItemUpdateError' });
  });
});

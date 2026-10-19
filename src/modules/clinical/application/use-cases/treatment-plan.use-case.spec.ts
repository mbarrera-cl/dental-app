import { Patient } from '../../../patients/domain/patient.entity.js';
import { InMemoryPatientRepository } from '../../../patients/infrastructure/adapters/persistence/in-memory-patient.repository.js';
import { GetQuoteUseCase } from '../../../quotes/application/use-cases/get-quote.use-case.js';
import { QuoteRepositoryPort } from '../../../quotes/application/ports/quote-repository.port.js';
import { Quote } from '../../../quotes/domain/quote.entity.js';
import { ClinicalRecordLockedError } from '../../domain/clinical.errors.js';
import { InMemoryClinicalRecordRepository } from '../../infrastructure/adapters/persistence/in-memory-clinical-record.repository.js';
import { InMemoryTreatmentPlanRepository } from '../../infrastructure/adapters/persistence/in-memory-treatment-plan.repository.js';
import { CreateClinicalRecordUseCase } from './create-clinical-record.use-case.js';
import { DeleteTreatmentPlanItemUseCase } from './delete-treatment-plan-item.use-case.js';
import { FinalizeClinicalRecordUseCase } from './finalize-clinical-record.use-case.js';
import { GetTreatmentPlanUseCase } from './get-treatment-plan.use-case.js';
import { ImportQuoteIntoTreatmentPlanUseCase } from './import-quote-into-treatment-plan.use-case.js';
import { PreviewQuoteImportUseCase } from './preview-quote-import.use-case.js';
import { RestoreTreatmentPlanItemUseCase } from './restore-treatment-plan-item.use-case.js';
import { UpdateTreatmentPlanItemUseCase } from './update-treatment-plan-item.use-case.js';
import { UpdateTreatmentPlanNotesUseCase } from './update-treatment-plan-notes.use-case.js';

/** Minimal in-memory quotation store: only `findById` is exercised. */
class FakeQuoteRepository extends QuoteRepositoryPort {
  private readonly quotes = new Map<string, Quote>();

  add(quote: Quote): void {
    this.quotes.set(quote.id, quote);
  }

  async save(quote: Quote): Promise<void> {
    this.quotes.set(quote.id, quote);
  }

  async update(quote: Quote): Promise<void> {
    this.quotes.set(quote.id, quote);
  }

  async findById(id: string): Promise<Quote | null> {
    return this.quotes.get(id) ?? null;
  }

  async findByFolio(): Promise<Quote | null> {
    return null;
  }

  async findAll(): Promise<Quote[]> {
    return [...this.quotes.values()];
  }

  async nextFolioNumber(): Promise<number> {
    return 1;
  }

  async appendVersion(): Promise<void> {}

  async listVersions() {
    return [];
  }
}

describe('Treatment plan use cases', () => {
  const setup = async () => {
    const patients = new InMemoryPatientRepository();
    const records = new InMemoryClinicalRecordRepository();
    const plans = new InMemoryTreatmentPlanRepository();
    const quotes = new FakeQuoteRepository();
    const getQuote = new GetQuoteUseCase(quotes);

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

    const approvedQuote = Quote.create({
      folio: 'P-000001',
      patientId: patient.id,
      patientName: 'Camila Rojas Pérez',
      patientRut: '12.345.678-5',
      patientEmail: null,
      validUntil: null,
      notes: null,
      items: [
        {
          ucoCode: 'ENDO-MOLAR',
          description: 'Endodoncia pieza 36',
          piezaDental: '36',
          quantity: 1,
          unitPrice: 100_000,
        },
        {
          ucoCode: 'PROF',
          description: 'Profilaxis',
          piezaDental: null,
          quantity: 1,
          unitPrice: 20_000,
        },
      ],
      createdBy: 'user-1',
      createdByName: 'Admin',
    });
    approvedQuote.changeStatus('aprobada', 'user-1', 'Admin');
    quotes.add(approvedQuote);

    return {
      records,
      plans,
      quotes,
      record,
      patient,
      approvedQuote,
      getPlan: new GetTreatmentPlanUseCase(records, plans),
      updateItem: new UpdateTreatmentPlanItemUseCase(records, plans),
      deleteItem: new DeleteTreatmentPlanItemUseCase(records, plans),
      restoreItem: new RestoreTreatmentPlanItemUseCase(records, plans),
      updateNotes: new UpdateTreatmentPlanNotesUseCase(records, plans),
      previewImport: new PreviewQuoteImportUseCase(records, plans, getQuote),
      importQuote: new ImportQuoteIntoTreatmentPlanUseCase(
        records,
        plans,
        getQuote,
      ),
    };
  };

  it('imports an approved quotation with code, text and the source link', async () => {
    const { record, approvedQuote, importQuote, getPlan, plans } = await setup();

    const imported = await importQuote.execute({
      recordId: record.id,
      quoteId: approvedQuote.id,
      actorId: 'user-1',
    });

    expect(imported).toHaveLength(2);
    expect(imported[0].ucoCode).toBe('ENDO-MOLAR');
    expect(imported[0].procedure).toBe('Endodoncia pieza 36');
    expect(imported[0].tooth).toBe(36);
    expect(imported[0].sourceQuoteItemId).toBe(approvedQuote.items[0].id);
    expect(imported[0].status).toBe('pendiente');
    expect(imported[1].tooth).toBeNull();

    const plan = await plans.findPlanByRecordId(record.id);
    const view = await getPlan.execute({ recordId: record.id });
    expect(plan).not.toBeNull();
    expect(view.items).toHaveLength(2);
  });

  it('is idempotent: re-importing the same quotation duplicates nothing', async () => {
    const { record, approvedQuote, importQuote, getPlan } = await setup();

    await importQuote.execute({
      recordId: record.id,
      quoteId: approvedQuote.id,
      actorId: 'user-1',
    });
    const again = await importQuote.execute({
      recordId: record.id,
      quoteId: approvedQuote.id,
      actorId: 'user-1',
    });

    expect(again).toHaveLength(0);
    expect((await getPlan.execute({ recordId: record.id })).items).toHaveLength(2);
  });

  it('flags ambiguity when the code + tooth already exists from another quote', async () => {
    const { record, approvedQuote, quotes, patient, previewImport, importQuote } =
      await setup();

    await importQuote.execute({
      recordId: record.id,
      quoteId: approvedQuote.id,
      actorId: 'user-1',
    });

    const supplementary = Quote.create({
      folio: 'P-000002',
      patientId: patient.id,
      patientName: 'Camila Rojas Pérez',
      patientRut: '12.345.678-5',
      patientEmail: null,
      validUntil: null,
      notes: null,
      items: [
        {
          ucoCode: 'ENDO-MOLAR',
          description: 'Endodoncia pieza 36 (retratamiento)',
          piezaDental: '36',
          quantity: 1,
          unitPrice: 120_000,
        },
      ],
      createdBy: 'user-1',
      createdByName: 'Admin',
    });
    supplementary.changeStatus('aprobada', 'user-1', 'Admin');
    quotes.add(supplementary);

    const preview = await previewImport.execute({
      recordId: record.id,
      quoteId: supplementary.id,
    });

    expect(preview.items).toHaveLength(1);
    expect(preview.items[0].flag).toBe('ambiguo');

    // Not imported unless explicitly selected.
    const skipped = await importQuote.execute({
      recordId: record.id,
      quoteId: supplementary.id,
      actorId: 'user-1',
    });
    expect(skipped).toHaveLength(0);

    // Explicitly choosing it imports it.
    const chosen = await importQuote.execute({
      recordId: record.id,
      quoteId: supplementary.id,
      itemIds: [supplementary.items[0].id],
      actorId: 'user-1',
    });
    expect(chosen).toHaveLength(1);
  });

  it('advances the status, recording the completion date, and audits it', async () => {
    const { records, record, approvedQuote, importQuote, updateItem } =
      await setup();

    const [item] = await importQuote.execute({
      recordId: record.id,
      quoteId: approvedQuote.id,
      actorId: 'user-1',
    });

    const updated = await updateItem.execute({
      itemId: item.id,
      actorId: 'user-1',
      status: 'realizado',
    });

    expect(updated.status).toBe('realizado');
    expect(updated.realizadoBy).toBe('user-1');
    expect(updated.realizadoAt).not.toBeNull();

    const events = await records.listEvents(record.id);
    expect(events.map((event) => event.action)).toContain(
      'plan-item-actualizado',
    );
  });

  it('on a finalized record allows only status changes', async () => {
    const { records, record, approvedQuote, importQuote, updateItem } =
      await setup();

    const [item] = await importQuote.execute({
      recordId: record.id,
      quoteId: approvedQuote.id,
      actorId: 'user-1',
    });

    await new FinalizeClinicalRecordUseCase(records).execute({
      id: record.id,
      actorId: 'user-1',
    });

    const updated = await updateItem.execute({
      itemId: item.id,
      actorId: 'user-1',
      status: 'realizado',
    });
    expect(updated.status).toBe('realizado');

    await expect(
      updateItem.execute({
        itemId: item.id,
        actorId: 'user-1',
        procedure: 'Otro',
      }),
    ).rejects.toBeInstanceOf(ClinicalRecordLockedError);

    await expect(
      importQuote.execute({
        recordId: record.id,
        quoteId: approvedQuote.id,
        actorId: 'user-1',
      }),
    ).rejects.toBeInstanceOf(ClinicalRecordLockedError);
  });

  it('soft-deletes with a reason, lists the trash and restores', async () => {
    const { records, record, approvedQuote, importQuote, deleteItem, restoreItem, getPlan } =
      await setup();

    const [item] = await importQuote.execute({
      recordId: record.id,
      quoteId: approvedQuote.id,
      actorId: 'user-1',
    });

    await deleteItem.execute({
      itemId: item.id,
      actorId: 'user-1',
      reason: 'Duplicado',
    });

    expect((await getPlan.execute({ recordId: record.id })).items).toHaveLength(1);
    expect(
      (await getPlan.execute({ recordId: record.id, deleted: true })).items,
    ).toHaveLength(1);

    await restoreItem.execute({ itemId: item.id, actorId: 'user-1' });

    expect((await getPlan.execute({ recordId: record.id })).items).toHaveLength(2);
    expect(
      (await getPlan.execute({ recordId: record.id, deleted: true })).items,
    ).toHaveLength(0);

    const events = await records.listEvents(record.id);
    const actions = events.map((event) => event.action);
    expect(actions).toContain('plan-item-eliminado');
    expect(actions).toContain('plan-item-restaurado');
  });

  it('rejects an empty item update', async () => {
    const { record, approvedQuote, importQuote, updateItem } = await setup();

    const [item] = await importQuote.execute({
      recordId: record.id,
      quoteId: approvedQuote.id,
      actorId: 'user-1',
    });

    await expect(
      updateItem.execute({ itemId: item.id, actorId: 'user-1' }),
    ).rejects.toMatchObject({ name: 'EmptyTreatmentPlanItemUpdateError' });
  });

  it('updates the plan-level rich-text note', async () => {
    const { record, updateNotes, getPlan } = await setup();

    await updateNotes.execute({
      recordId: record.id,
      actorId: 'user-1',
      notes: '<p>Nota <strong>importante</strong></p><script>x</script>',
    });

    expect((await getPlan.execute({ recordId: record.id })).plan.notes).toBe(
      '<p>Nota <strong>importante</strong></p>',
    );
  });
});

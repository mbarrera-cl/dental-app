import { InMemoryLedgerRepository } from '../../infrastructure/adapters/persistence/in-memory-ledger.repository.js';
import { RecordQuoteChargeUseCase } from './record-quote-charge.use-case.js';

describe('RecordQuoteChargeUseCase', () => {
  const setup = () => {
    const ledger = new InMemoryLedgerRepository();
    const useCase = new RecordQuoteChargeUseCase(ledger);

    return { ledger, useCase };
  };

  const command = {
    quoteId: 'quote-1',
    folio: 'COT-2026-0001',
    patientId: 'patient-1',
    amount: 13000,
    actorId: 'user-1',
  } as const;

  it('charges the approved total with the folio concept and a frozen snapshot', async () => {
    const { ledger, useCase } = setup();

    const movement = await useCase.execute(command);

    expect(movement).not.toBeNull();
    expect(movement!.kind).toBe('cargo');
    expect(movement!.amount).toBe(13000);
    expect(movement!.concept).toBe('Presupuesto COT-2026-0001 — aprobado');
    expect(movement!.method).toBeNull();
    expect(movement!.quoteId).toBe('quote-1');
    expect(movement!.patientId).toBe('patient-1');
    expect(movement!.createdBy).toBe('user-1');
    expect(await ledger.patientBalance('patient-1')).toBe(13000);
  });

  it('is idempotent: re-approving the same quote never duplicates the charge', async () => {
    const { ledger, useCase } = setup();

    await useCase.execute(command);
    const first = (await ledger.listByQuoteId('quote-1')).at(0);
    const second = await useCase.execute({
      ...command,
      actorId: 'user-2',
    });

    expect(second).toBeNull();
    const charges = (await ledger.listByQuoteId('quote-1')).filter((m) => m.kind === 'cargo');
    expect(charges).toHaveLength(1);
    expect(charges[0]!.id).toBe(first!.id);
    expect(charges[0]!.createdBy).toBe('user-1');
  });

  it('charges again only after the previous cargo is voided', async () => {
    const { ledger, useCase } = setup();

    const first = await useCase.execute(command);
    first!.void('user-2', 'Error de monto');
    await ledger.replace(first!);

    const again = await useCase.execute({ ...command, amount: 14000 });

    expect(again).not.toBeNull();
    expect(again!.amount).toBe(14000);
    expect((await ledger.listByQuoteId('quote-1')).filter((m) => m.kind === 'cargo')).toHaveLength(2);
  });

  it('charges nothing for a zero amount', async () => {
    const { ledger, useCase } = setup();

    const movement = await useCase.execute({ ...command, amount: 0 });

    expect(movement).toBeNull();
    expect((await ledger.listByQuoteId('quote-1')).length).toBe(0);
  });
});

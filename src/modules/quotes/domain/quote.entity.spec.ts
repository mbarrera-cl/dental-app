import { describe, expect, it } from 'vitest';
import { Quote } from './quote.entity.js';

function makeQuote(overrides: Partial<Parameters<Quote['create']>[0]> = {}) {
  return Quote.create({
    folio: 'COT-2026-0001',
    patientId: 'p-1',
    patientName: 'Camila Rojas',
    patientRut: '12345678-5',
    patientEmail: null,
    validUntil: new Date('2026-11-17'),
    notes: null,
    items: [
      { description: 'Obturación', quantity: 1, unitPrice: 4000 },
      { description: 'Endodoncia', quantity: 1, unitPrice: 10000, discountPercent: 10 },
    ],
    createdBy: 'u-1',
    createdByName: 'Ana',
    ...overrides,
  });
}

describe('Quote', () => {
  it('recomputes totals across the lines', () => {
    const quote = makeQuote();

    expect(quote.subtotal).toBe(14000);
    expect(quote.discountTotal).toBe(1000);
    expect(quote.total).toBe(13000);
    expect(quote.approvedTotal).toBe(0);
  });

  it('opens as a draft version 1 and records the creator', () => {
    const quote = makeQuote();

    expect(quote.status).toBe('borrador');
    expect(quote.version).toBe(1);
    expect(quote.createdByName).toBe('Ana');
    expect(quote.sanctionedByName).toBeNull();
  });

  it('updates lines, recomputes totals and bumps the version', () => {
    const quote = makeQuote();

    quote.update({
      items: [
        { description: 'Obturación', quantity: 2, unitPrice: 4000 },
        { description: 'Corona', quantity: 1, unitPrice: 15000 },
      ],
      actorId: 'u-2',
      actorName: 'Luis',
    });

    expect(quote.items).toHaveLength(2);
    expect(quote.subtotal).toBe(23000);
    expect(quote.version).toBe(2);
    expect(quote.updatedByName).toBe('Luis');
  });

  it('updates the description of an existing line', () => {
    const quote = makeQuote();
    const first = quote.items[0]!;

    quote.update({
      items: [
        {
          id: first.id,
          ucoCode: first.ucoCode,
          description: 'Obturación modificada',
          quantity: 2,
          unitPrice: 4500,
        },
      ],
      actorId: 'u-2',
      actorName: 'Luis',
    });

    expect(quote.items[0]?.description).toBe('Obturación modificada');
    expect(quote.items[0]?.quantity).toBe(2);
    expect(quote.total).toBe(9000);
  });

  it('decides an item and computes the approved total', () => {
    const quote = makeQuote();

    const first = quote.items[0]!;
    quote.decideItem(first.id, 'aprobado', 'u-2', 'Luis');

    expect(first.status).toBe('aprobado');
    expect(quote.approvedTotal).toBe(first.netAmount);
  });

  it('sanctions the quote and still allows editing it explicitly', () => {
    const quote = makeQuote();

    quote.sanction('aprobada', 'u-3', 'María');
    expect(quote.status).toBe('aprobada');
    expect(quote.sanctionedByName).toBe('María');
    expect(quote.sanctionedAt).not.toBeNull();

    quote.update({
      items: [{ description: 'X', quantity: 1, unitPrice: 10 }],
      actorId: 'u',
      actorName: 'X',
    });

    expect(quote.status).toBe('aprobada');
    expect(quote.total).toBe(10);
  });

  it('approving approves every line in a chain, so approvedTotal matches the total', () => {
    const quote = makeQuote();
    quote.decideItem(quote.items[1]!.id, 'rechazado', 'u-2', 'Luis');

    quote.sanction('aprobada', 'u-3', 'María');

    for (const item of quote.items) {
      expect(item.status).toBe('aprobado');
    }
    expect(quote.approvedTotal).toBe(quote.total);
    // The chain decision is recorded by the sanctioning actor.
    expect(quote.items[0]!.statusChangedByName).toBe('María');
  });

  it('approving keeps the metadata of lines that were already approved', () => {
    const quote = makeQuote();
    quote.decideItem(quote.items[0]!.id, 'aprobado', 'u-2', 'Luis');

    quote.sanction('aprobada', 'u-3', 'María');

    expect(quote.items[0]!.statusChangedByName).toBe('Luis');
    expect(quote.items[1]!.statusChangedByName).toBe('María');
    expect(quote.approvedTotal).toBe(quote.total);
  });

  it('rejecting does not approve the lines', () => {
    const quote = makeQuote();

    quote.sanction('rechazada', 'u-3', 'María');

    for (const item of quote.items) {
      expect(item.status).toBe('generado');
    }
    expect(quote.approvedTotal).toBe(0);
  });

  it('changes status explicitly and keeps sanction metadata coherent', () => {
    const quote = makeQuote();

    quote.changeStatus('sin_respuesta', 'u-1', 'Ana');
    expect(quote.status).toBe('sin_respuesta');
    expect(quote.sanctionedAt).toBeNull();

    quote.changeStatus('rechazada', 'u-2', 'Luis');
    expect(quote.status).toBe('rechazada');
    expect(quote.sanctionedByName).toBe('Luis');

    quote.changeStatus('aprobada', 'u-3', 'María');
    expect(quote.status).toBe('aprobada');
    expect(quote.sanctionedByName).toBe('María');

    quote.changeStatus('borrador', 'u-4', 'Pedro');
    expect(quote.status).toBe('borrador');
    expect(quote.sanctionedBy).toBeNull();
    expect(quote.sanctionedAt).toBeNull();
  });

  it('moves to the trash and back, preserving the status and history', () => {
    const quote = makeQuote();

    quote.sanction('aprobada', 'u-1', 'Ana');
    const statusBefore = quote.status;

    quote.softDelete('u-2', 'Luis');
    expect(quote.isDeleted).toBe(true);
    expect(quote.deletedByName).toBe('Luis');
    expect(quote.status).toBe(statusBefore);

    // Idempotent: a second delete does not move the timestamp/version.
    const versionAfterDelete = quote.version;
    quote.softDelete('u-2', 'Luis');
    expect(quote.version).toBe(versionAfterDelete);

    // A trashed quote cannot be edited nor sanctioned.
    expect(() =>
      quote.update({ items: [{ description: 'X', quantity: 1, unitPrice: 10 }], actorId: 'u', actorName: 'X' }),
    ).toThrow('quotes.status.deleted');
    expect(() => quote.sanction('rechazada', 'u', 'X')).toThrow('quotes.status.deleted');

    quote.restore('u-3', 'María');
    expect(quote.isDeleted).toBe(false);
    expect(quote.deletedByName).toBeNull();
    expect(quote.status).toBe(statusBefore);
  });

  it('duplicates into a new draft version referencing the source', () => {
    const source = makeQuote();
    const copy = source.duplicate('u-2', 'Luis', 'COT-2026-0002');

    expect(copy.status).toBe('borrador');
    expect(copy.version).toBe(1);
    expect(copy.replacesQuoteId).toBe(source.id);
    expect(copy.folio).toBe('COT-2026-0002');
    expect(copy.sanctionedByName).toBeNull();
    expect(copy.items).toHaveLength(source.items.length);
  });
});

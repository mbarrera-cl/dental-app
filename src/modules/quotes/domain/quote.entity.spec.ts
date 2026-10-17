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

  it('decides an item and computes the approved total', () => {
    const quote = makeQuote();

    const first = quote.items[0]!;
    quote.decideItem(first.id, 'aprobado', 'u-2', 'Luis');

    expect(first.status).toBe('aprobado');
    expect(quote.approvedTotal).toBe(first.netAmount);
  });

  it('sanctions the quote and locks it', () => {
    const quote = makeQuote();

    quote.sanction('aprobada', 'u-3', 'María');
    expect(quote.status).toBe('aprobada');
    expect(quote.sanctionedByName).toBe('María');
    expect(quote.sanctionedAt).not.toBeNull();

    expect(() =>
      quote.update({ items: [{ description: 'X', quantity: 1, unitPrice: 10 }], actorId: 'u', actorName: 'X' }),
    ).toThrow('quotes.status.locked');
  });

  it('cannot sanction twice', () => {
    const quote = makeQuote();
    quote.sanction('rechazada', 'u-1', 'Ana');

    expect(() => quote.sanction('aprobada', 'u-2', 'Luis')).toThrow('quotes.status.alreadySanctioned');
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

import { describe, expect, it } from 'vitest';
import { computeItemTotals, QuoteItem } from './quote-item.entity.js';

describe('QuoteItem', () => {
  it('computes a line without discount', () => {
    const item = QuoteItem.create({
      description: 'Obturación',
      quantity: 2,
      unitPrice: 4500,
    });

    expect(item.subtotal).toBe(9000);
    expect(item.discountAmount).toBe(0);
    expect(item.netAmount).toBe(9000);
    expect(item.status).toBe('generado');
  });

  it('computes the discount and rounds to integer CLP', () => {
    const item = QuoteItem.create({
      description: 'Endodoncia',
      quantity: 1,
      unitPrice: 10000,
      discountPercent: 15,
    });

    expect(item.subtotal).toBe(10000);
    expect(item.discountAmount).toBe(1500);
    expect(item.netAmount).toBe(8500);
  });

  it('decides and reopens a line recording who/when', () => {
    const item = QuoteItem.create({ description: 'X', quantity: 1, unitPrice: 100 });

    item.decide('aprobado', 'user-1', 'Ana');
    expect(item.status).toBe('aprobado');
    expect(item.statusChangedByName).toBe('Ana');

    item.reopen('user-2', 'Luis');
    expect(item.status).toBe('generado');
  });
});

describe('computeItemTotals', () => {
  it('rejects a discount above 100%', () => {
    expect(() => computeItemTotals({ quantity: 1, unitPrice: 100, discountPercent: 101 })).toThrow(
      'quotes.item.invalidDiscount',
    );
  });

  it('truncates quantity and rounds the unit price', () => {
    const totals = computeItemTotals({ quantity: 2.7, unitPrice: 199.6, discountPercent: 0 });
    expect(totals).toEqual({ subtotal: 400, discountAmount: 0, netAmount: 400 });
  });
});

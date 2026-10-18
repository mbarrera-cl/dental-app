import { Movement } from './movement.entity.js';
import { InvalidMovementError, MovementAlreadyVoidedError } from './payment.errors.js';

describe('Movement', () => {
  it('creates a cargo without payment method, reference or links', () => {
    const movement = Movement.create({
      kind: 'cargo',
      amount: 4500,
      method: null,
      reference: 'voucher 123',
      concept: '  Resina compuesta pieza 1.6  ',
      patientId: 'patient-1',
      quoteId: '  ',
      appointmentId: undefined,
      createdBy: 'user-1',
    });

    expect(movement.kind).toBe('cargo');
    expect(movement.amount).toBe(4500);
    expect(movement.signedAmount).toBe(4500);
    expect(movement.method).toBeNull();
    expect(movement.reference).toBeNull();
    expect(movement.concept).toBe('Resina compuesta pieza 1.6');
    expect(movement.patientId).toBe('patient-1');
    expect(movement.quoteId).toBeNull();
    expect(movement.appointmentId).toBeNull();
    expect(movement.createdBy).toBe('user-1');
    expect(movement.isVoided).toBe(false);
    expect(movement.id).toEqual(expect.any(String));
  });

  it('creates a payment with a method and a reference', () => {
    const movement = Movement.create({
      kind: 'abono',
      amount: 20000,
      method: 'transferencia',
      reference: ' op/42 BancoEstado ',
      concept: 'Abono presupuestar COT-2026-0001',
      patientId: 'patient-1',
      createdBy: null,
    });

    expect(movement.kind).toBe('abono');
    expect(movement.signedAmount).toBe(-20000);
    expect(movement.method).toBe('transferencia');
    expect(movement.reference).toBe('op/42 BancoEstado');
  });

  it('rejects non-integer, zero and negative amounts', () => {
    for (const amount of [0, -1, 45.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        Movement.create({
          kind: 'cargo',
          amount,
          method: null,
          reference: null,
          concept: 'Consulta',
          patientId: 'patient-1',
          createdBy: null,
        }),
      ).toThrow(InvalidMovementError);
    }
  });

  it('rejects an empty or over-long concept', () => {
    expect(() =>
      Movement.create({
        kind: 'cargo',
        amount: 100,
        method: null,
        reference: null,
        concept: '   ',
        patientId: 'patient-1',
        createdBy: null,
      }),
    ).toThrow(InvalidMovementError);

    expect(() =>
      Movement.create({
        kind: 'cargo',
        amount: 100,
        method: null,
        reference: null,
        concept: 'x'.repeat(301),
        patientId: 'patient-1',
        createdBy: null,
      }),
    ).toThrow(InvalidMovementError);
  });

  it('requires a valid method and a patient for payments', () => {
    const payment = {
      kind: 'abono' as const,
      amount: 100,
      reference: null,
      concept: 'Abono',
      patientId: 'patient-1',
      createdBy: null,
    };

    expect(() =>
      Movement.create({ ...payment, method: null }),
    ).toThrow(InvalidMovementError);
    expect(() =>
      Movement.create({ ...payment, method: 'paypal' as never }),
    ).toThrow(InvalidMovementError);
    expect(() =>
      Movement.create({ ...payment, method: 'efectivo', patientId: '  ' }),
    ).toThrow(InvalidMovementError);
  });

  it('rejects payloads without an underlying kind', () => {
    expect(() =>
      Movement.create({
        kind: 'traspaso' as never,
        amount: 100,
        method: null,
        reference: null,
        concept: 'Abono',
        patientId: 'patient-1',
        createdBy: null,
      }),
    ).toThrow(InvalidMovementError);
  });

  it('voids once and leaves the amount intact, then rejects a second void', () => {
    const movement = Movement.create({
      kind: 'abono',
      amount: 5000,
      method: 'efectivo',
      reference: null,
      concept: 'Abono',
      patientId: 'patient-1',
      createdBy: 'user-1',
    });
    const before = movement.voidedAt;

    movement.void('user-2', '  pago duplicado  ');

    expect(before).toBeNull();
    expect(movement.isVoided).toBe(true);
    expect(movement.amount).toBe(5000);
    expect(movement.signedAmount).toBe(-5000);
    expect(movement.voidedBy).toBe('user-2');
    expect(movement.voidReason).toBe('pago duplicado');
    expect(movement.voidedAt).toEqual(expect.any(Date));

    expect(() => movement.void('user-2', 'otra vez')).toThrow(MovementAlreadyVoidedError);
  });

  it('rejects an empty void reason', () => {
    const movement = Movement.create({
      kind: 'cargo',
      amount: 100,
      method: null,
      reference: null,
      concept: 'Consulta',
      patientId: 'patient-1',
      createdBy: null,
    });

    expect(() => movement.void('user-2', '  ')).toThrow(InvalidMovementError);
  });

  it('rejects a cargo that tries to carry a payment method', () => {
    expect(() =>
      Movement.create({
        kind: 'cargo',
        amount: 100,
        method: 'tarjeta',
        reference: null,
        concept: 'Consulta',
        patientId: 'patient-1',
        createdBy: null,
      }),
    ).toThrow(InvalidMovementError);
  });

  it('answers to its identity, not to its attributes', () => {
    const props = {
      kind: 'cargo' as const,
      amount: 100,
      method: null,
      reference: null,
      concept: 'Consulta',
      patientId: 'patient-1',
      createdBy: null,
    };
    const first = Movement.create(props);
    const second = Movement.reconstitute(
      {
        ...props,
        createdAt: new Date(),
        voidedAt: null,
        voidedBy: null,
        voidReason: null,
      },
      first.id,
    );

    expect(first.equals(second)).toBe(true);
    expect(first.equals(undefined)).toBe(false);
  });
});

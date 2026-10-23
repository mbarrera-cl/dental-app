import {
  TreatmentPlan,
  TreatmentPlanItem,
  TREATMENT_PLAN_ITEM_STATUSES,
} from './treatment-plan.entity.js';

describe('TreatmentPlanItem', () => {
  const createItem = (tooth: number | null = 36) =>
    TreatmentPlanItem.create({
      planId: 'plan-1',
      tooth,
      procedure: 'Endodoncia pieza 36',
      position: 0,
      createdBy: 'user-1',
    });

  it('defaults to pendiente and accepts a null tooth', () => {
    const item = createItem(null);

    expect(item.status).toBe('pendiente');
    expect(item.tooth).toBeNull();
    expect(item.ucoCode).toBeNull();
    expect(item.notes).toBeNull();
    expect(item.statusChangedAt).toBeNull();
    expect(item.realizadoAt).toBeNull();
    expect(item.isDeleted).toBe(false);
  });

  it('validates the tooth against the FDI range', () => {
    expect(() =>
      TreatmentPlanItem.create({
        planId: 'plan-1',
        tooth: 19,
        procedure: 'x',
        position: 0,
        createdBy: 'user-1',
      }),
    ).toThrow(expect.objectContaining({ name: 'InvalidTreatmentPlanError' }));
  });

  it('validates the procedure and status', () => {
    expect(() =>
      TreatmentPlanItem.create({
        planId: 'plan-1',
        procedure: '   ',
        position: 0,
        createdBy: 'user-1',
      }),
    ).toThrow(expect.objectContaining({ name: 'InvalidTreatmentPlanError' }));

    const item = createItem();
    expect(() => item.changeStatus('inexistente', 'user-1')).toThrow(
      expect.objectContaining({ name: 'InvalidTreatmentPlanError' }),
    );
  });

  it('records who/when marking it done and clears it when leaving that state', () => {
    const item = createItem();
    const when = new Date('2026-10-18T12:00:00.000Z');

    item.changeStatus('realizado', 'user-2', when);

    expect(item.status).toBe('realizado');
    expect(item.statusChangedBy).toBe('user-2');
    expect(item.statusChangedAt).toEqual(when);
    expect(item.realizadoBy).toBe('user-2');
    expect(item.realizadoAt).toEqual(when);

    item.changeStatus('pendiente', 'user-2');

    expect(item.realizadoAt).toBeNull();
    expect(item.realizadoBy).toBeNull();
  });

  it('does not touch the status audit when the value is unchanged', () => {
    const item = createItem();

    item.changeStatus('pendiente', 'user-2');

    expect(item.statusChangedAt).toBeNull();
    expect(item.statusChangedBy).toBeNull();
  });

  it('sanitizes rich-text notes and stores empty ones as null', () => {
    const item = createItem();

    item.changeNotes('<p>Hola <strong>mundo</strong></p><script>alert(1)</script>', 'user-1');
    expect(item.notes).toBe('<p>Hola <strong>mundo</strong></p>');
    expect(item.notesUpdatedBy).toBe('user-1');
    expect(item.notesUpdatedAt).not.toBeNull();

    item.changeNotes('<p><br></p>', 'user-1');
    expect(item.notes).toBeNull();
  });

  it('soft-deletes with a mandatory reason and restores it', () => {
    const item = createItem();

    expect(() => item.softDelete('user-1', '   ')).toThrow(
      expect.objectContaining({ name: 'InvalidTreatmentPlanError' }),
    );

    item.softDelete('user-1', 'Procedimiento duplicado');

    expect(item.isDeleted).toBe(true);
    expect(item.deletedBy).toBe('user-1');
    expect(item.deletedReason).toBe('Procedimiento duplicado');

    expect(() => item.softDelete('user-1', 'otra')).toThrow(
      expect.objectContaining({ name: 'TreatmentPlanItemAlreadyDeletedError' }),
    );

    item.restore('user-2');

    expect(item.isDeleted).toBe(false);
    expect(item.deletedAt).toBeNull();
    expect(item.deletedReason).toBeNull();

    expect(() => item.restore('user-2')).toThrow(
      expect.objectContaining({ name: 'TreatmentPlanItemNotDeletedError' }),
    );
  });
});

describe('TreatmentPlan', () => {
  it('carries the record id and the simplified statuses', () => {
    const plan = TreatmentPlan.create('record-1');

    expect(plan.recordId).toBe('record-1');
    expect(plan.notes).toBeNull();
    expect(TREATMENT_PLAN_ITEM_STATUSES).toEqual([
      'pendiente',
      'realizado',
      'cancelado',
    ]);
  });

  it('sanitizes plan-level notes', () => {
    const plan = TreatmentPlan.create('record-1');

    plan.changeNotes('<p>Nota</p><img src=x onerror=alert(1)>', 'user-1');

    expect(plan.notes).toBe('<p>Nota</p>');
    expect(plan.notesUpdatedBy).toBe('user-1');
  });
});

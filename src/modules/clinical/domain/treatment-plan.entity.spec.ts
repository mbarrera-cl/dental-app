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

  it('defaults to planificado and accepts a null tooth', () => {
    const item = createItem(null);

    expect(item.status).toBe('planificado');
    expect(item.tooth).toBeNull();
    expect(item.ucoCode).toBeNull();
    expect(item.notes).toBeNull();
    expect(item.statusChangedAt).toBeNull();
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

  it('records who/when the status changed', () => {
    const item = createItem();
    const when = new Date('2026-10-18T12:00:00.000Z');

    item.changeStatus('realizado', 'user-2', when);

    expect(item.status).toBe('realizado');
    expect(item.statusChangedBy).toBe('user-2');
    expect(item.statusChangedAt).toEqual(when);
  });

  it('does not touch the status audit when the value is unchanged', () => {
    const item = createItem();

    item.changeStatus('planificado', 'user-2');

    expect(item.statusChangedAt).toBeNull();
    expect(item.statusChangedBy).toBeNull();
  });
});

describe('TreatmentPlan', () => {
  it('carries the record id', () => {
    const plan = TreatmentPlan.create('record-1');

    expect(plan.recordId).toBe('record-1');
    expect(TREATMENT_PLAN_ITEM_STATUSES).toContain('realizado');
  });
});

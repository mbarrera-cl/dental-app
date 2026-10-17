import { describe, expect, it } from 'vitest';
import { UcoProcedure } from './uco-procedure.entity.js';

describe('UcoProcedure', () => {
  it('normalizes the code to uppercase and trims whitespace', () => {
    const procedure = UcoProcedure.create({
      code: ' 010001 ',
      chapter: '1',
      name: 'Consulta',
      units: 1,
    });

    expect(procedure.code).toBe('010001');
    expect(procedure.status).toBe('active');
  });

  it('rounds decimal units to three decimals', () => {
    const procedure = UcoProcedure.create({
      code: 'X1',
      chapter: '2',
      name: 'Procedimiento',
      units: 1.1234567,
    });

    expect(procedure.units).toBe(1.123);
  });

  it('rejects empty names, chapters and codes', () => {
    expect(() =>
      UcoProcedure.create({ code: '', chapter: '1', name: 'X', units: 1 }),
    ).toThrow('uco.invalidCode');
    expect(() =>
      UcoProcedure.create({ code: 'X1', chapter: '', name: 'X', units: 1 }),
    ).toThrow('uco.chapter.required');
    expect(() =>
      UcoProcedure.create({ code: 'X1', chapter: '1', name: '  ', units: 1 }),
    ).toThrow('uco.name.required');
  });

  it('rejects non-positive units', () => {
    expect(() =>
      UcoProcedure.create({ code: 'X1', chapter: '1', name: 'X', units: 0 }),
    ).toThrow('uco.invalidUnits');
  });

  it('toggles the soft-delete status', () => {
    const procedure = UcoProcedure.create({ code: 'X1', chapter: '1', name: 'X', units: 1 });

    procedure.deactivate();
    expect(procedure.status).toBe('inactive');

    procedure.reactivate();
    expect(procedure.status).toBe('active');
  });
});

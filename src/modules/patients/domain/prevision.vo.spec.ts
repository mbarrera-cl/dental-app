import { InvalidPrevisionError } from './patient.errors.js';
import { Prevision } from './prevision.vo.js';

describe('Prevision', () => {
  it('accepts FONASA with a tramo and drops empty extras', () => {
    const prevision = Prevision.create({ tipo: 'fonasa', tramo: 'b' });

    expect(prevision.tipo).toBe('FONASA');
    expect(prevision.tramo).toBe('B');
    expect(prevision.plan).toBeNull();
  });

  it('accepts ISAPRE with a plan name, normalized', () => {
    const prevision = Prevision.create({
      tipo: 'isapre',
      plan: '  Consalud Plus ',
    });

    expect(prevision.tipo).toBe('ISAPRE');
    expect(prevision.tramo).toBeNull();
    expect(prevision.plan).toBe('Consalud Plus');
  });

  it('rejects FONASA without a tramo', () => {
    expect(() => Prevision.create({ tipo: 'FONASA' })).toThrow(
      InvalidPrevisionError,
    );
    expect(() => Prevision.create({ tipo: 'FONASA', tramo: 'E' })).toThrow(
      InvalidPrevisionError,
    );
  });

  it('rejects FONASA carrying an ISAPRE plan', () => {
    expect(() =>
      Prevision.create({ tipo: 'FONASA', tramo: 'A', plan: 'Consalud' }),
    ).toThrow(InvalidPrevisionError);
  });

  it('rejects ISAPRE without a plan name', () => {
    expect(() => Prevision.create({ tipo: 'ISAPRE' })).toThrow(
      InvalidPrevisionError,
    );
    expect(() => Prevision.create({ tipo: 'ISAPRE', plan: '   ' })).toThrow(
      InvalidPrevisionError,
    );
  });

  it('rejects ISAPRE carrying a FONASA tramo', () => {
    expect(() =>
      Prevision.create({ tipo: 'ISAPRE', tramo: 'C', plan: 'Colmena' }),
    ).toThrow(InvalidPrevisionError);
  });

  it('rejects unknown tipos', () => {
    expect(() => Prevision.create({ tipo: 'particular' })).toThrow(
      InvalidPrevisionError,
    );
  });
});

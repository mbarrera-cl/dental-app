import { InvalidPrevisionError } from './patient.errors.js';
import { Prevision } from './prevision.vo.js';

describe('Prevision', () => {
  it('accepts FONASA with a tramo and drops empty extras', () => {
    const prevision = Prevision.create({ tipo: 'fonasa', tramo: 'b' });

    expect(prevision.tipo).toBe('FONASA');
    expect(prevision.tramo).toBe('B');
    expect(prevision.plan).toBeNull();
    expect(prevision.convenio).toBeNull();
  });

  it('accepts ISAPRE with a plan name, normalized', () => {
    const prevision = Prevision.create({
      tipo: 'isapre',
      plan: '  Consalud Plus ',
    });

    expect(prevision.tipo).toBe('ISAPRE');
    expect(prevision.tramo).toBeNull();
    expect(prevision.plan).toBe('Consalud Plus');
    expect(prevision.convenio).toBeNull();
  });

  it('accepts PARTICULAR without coverage details', () => {
    const prevision = Prevision.create({ tipo: 'particular' });

    expect(prevision.tipo).toBe('PARTICULAR');
    expect(prevision.tramo).toBeNull();
    expect(prevision.plan).toBeNull();
    expect(prevision.convenio).toBeNull();
  });

  it('accepts CONVENIO with a name, normalized', () => {
    const prevision = Prevision.create({
      tipo: 'convenio',
      convenio: '  Colegio San Ignacio ',
    });

    expect(prevision.tipo).toBe('CONVENIO');
    expect(prevision.tramo).toBeNull();
    expect(prevision.plan).toBeNull();
    expect(prevision.convenio).toBe('Colegio San Ignacio');
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

  it('rejects FONASA carrying a convenio name', () => {
    expect(() =>
      Prevision.create({
        tipo: 'FONASA',
        tramo: 'A',
        convenio: 'Colegio San Ignacio',
      }),
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

  it('rejects ISAPRE carrying a convenio name', () => {
    expect(() =>
      Prevision.create({
        tipo: 'ISAPRE',
        plan: 'Colmena',
        convenio: 'Colegio San Ignacio',
      }),
    ).toThrow(InvalidPrevisionError);
  });

  it('rejects PARTICULAR carrying coverage details', () => {
    expect(() => Prevision.create({ tipo: 'PARTICULAR', tramo: 'A' })).toThrow(
      InvalidPrevisionError,
    );
    expect(() =>
      Prevision.create({ tipo: 'PARTICULAR', plan: 'Colmena' }),
    ).toThrow(InvalidPrevisionError);
    expect(() =>
      Prevision.create({
        tipo: 'PARTICULAR',
        convenio: 'Colegio San Ignacio',
      }),
    ).toThrow(InvalidPrevisionError);
  });

  it('rejects CONVENIO without a name', () => {
    expect(() => Prevision.create({ tipo: 'CONVENIO' })).toThrow(
      InvalidPrevisionError,
    );
    expect(() =>
      Prevision.create({ tipo: 'CONVENIO', convenio: '   ' }),
    ).toThrow(InvalidPrevisionError);
  });

  it('rejects CONVENIO carrying a tramo or an ISAPRE plan', () => {
    expect(() =>
      Prevision.create({
        tipo: 'CONVENIO',
        tramo: 'A',
        convenio: 'Colegio San Ignacio',
      }),
    ).toThrow(InvalidPrevisionError);
    expect(() =>
      Prevision.create({
        tipo: 'CONVENIO',
        plan: 'Colmena',
        convenio: 'Colegio San Ignacio',
      }),
    ).toThrow(InvalidPrevisionError);
  });

  it('rejects unknown tipos', () => {
    expect(() => Prevision.create({ tipo: 'otro' })).toThrow(
      InvalidPrevisionError,
    );
  });
});

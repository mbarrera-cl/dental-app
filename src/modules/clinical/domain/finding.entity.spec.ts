import { InvalidFindingError } from './clinical.errors.js';
import {
  Finding,
  defaultStateFor,
  isFdiTooth,
} from './finding.entity.js';

describe('Finding', () => {
  const valid = {
    recordId: 'record-1',
    tooth: 16,
    surfaces: ['O', 'M'],
    symbol: 'caries',
    createdBy: 'user-1',
  };

  it('derives the state from the symbol (red pending vs blue done)', () => {
    expect(defaultStateFor('caries')).toBe('a-realizar');
    expect(defaultStateFor('sellante-necesario')).toBe('a-realizar');
    expect(defaultStateFor('extraccion-indicada')).toBe('a-realizar');
    expect(defaultStateFor('obturado')).toBe('realizado');
    expect(defaultStateFor('sellante-realizado')).toBe('realizado');
    expect(defaultStateFor('perdida-caries')).toBe('realizado');

    const finding = Finding.create(valid);

    expect(finding.state).toBe('a-realizar');
    expect(finding.surfaces).toEqual(['O', 'M']);
    expect(finding.isVoided).toBe(false);
    expect(finding.createdAt).toBeInstanceOf(Date);
  });

  it('normalizes surfaces (case and duplicates)', () => {
    const finding = Finding.create({ ...valid, surfaces: ['o', 'O', 'm'] });

    expect(finding.surfaces).toEqual(['O', 'M']);
  });

  it('accepts primary teeth and rejects non-FDI pieces', () => {
    expect(isFdiTooth(55)).toBe(true);
    expect(isFdiTooth(48)).toBe(true);
    expect(isFdiTooth(19)).toBe(false);
    expect(isFdiTooth(56)).toBe(false);
    expect(isFdiTooth(99)).toBe(false);

    expect(() => Finding.create({ ...valid, tooth: 19 })).toThrow(
      InvalidFindingError,
    );
  });

  it('validates symbols, surfaces and recesion/movilidad grades', () => {
    expect(() => Finding.create({ ...valid, symbol: 'empaste' })).toThrow(
      InvalidFindingError,
    );
    expect(() => Finding.create({ ...valid, surfaces: ['X'] })).toThrow(
      InvalidFindingError,
    );
    expect(() => Finding.create({ ...valid, recesion: 4 })).toThrow(
      InvalidFindingError,
    );

    const finding = Finding.create({ ...valid, recesion: 2, movilidad: 1 });

    expect(finding.recesion).toBe(2);
    expect(finding.movilidad).toBe(1);
  });

  it('voids once, keeping who and when for the audit', () => {
    const finding = Finding.create(valid);
    const when = new Date('2026-10-16T12:00:00.000Z');

    finding.void('user-2', when);

    expect(finding.isVoided).toBe(true);
    expect(finding.voidedBy).toBe('user-2');
    expect(finding.voidedAt).toEqual(when);

    expect(() => finding.void('user-3')).toThrow(
      expect.objectContaining({ name: 'ClinicalFindingAlreadyVoidedError' }),
    );
  });
});

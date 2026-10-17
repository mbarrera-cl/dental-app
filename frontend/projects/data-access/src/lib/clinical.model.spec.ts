import { describe, expect, it } from 'vitest';
import {
  activeFindings,
  ageInYears,
  defaultStateFor,
  isPermanentTooth,
  isPrimaryTooth,
  suggestCategoriaEtaria,
  surfaceStates,
  toothGrades,
  toothSymbols,
  type ClinicalFinding,
  type FindingSymbol,
} from './clinical.model';

/** Finding factory with sane defaults; override whatever the test needs. */
export function buildFinding(
  tooth: number,
  symbol: FindingSymbol,
  overrides: Partial<ClinicalFinding> = {},
): ClinicalFinding {
  return {
    id: `finding-${tooth}-${symbol}-${overrides.id ?? 'x'}`,
    recordId: 'record-1',
    tooth,
    surfaces: [],
    symbol,
    state: defaultStateFor(symbol),
    recesion: null,
    movilidad: null,
    note: null,
    createdBy: 'user-1',
    createdAt: '2026-10-16T10:00:00.000Z',
    voidedAt: null,
    voidedBy: null,
    isVoided: false,
    ...overrides,
  };
}

describe('clinical.model', () => {
  describe('ageInYears', () => {
    const today = new Date('2026-10-16T12:00:00.000Z');

    it('does not count a birthday that has not happened yet', () => {
      expect(ageInYears('2000-12-31', today)).toBe(25);
      expect(ageInYears('2000-10-16', today)).toBe(26);
    });
  });

  describe('suggestCategoriaEtaria', () => {
    const today = new Date('2026-10-16T12:00:00.000Z');

    it('suggests the programmed category for each age range', () => {
      expect(suggestCategoriaEtaria('2026-01-01', today)).toBe('menor-1');
      expect(suggestCategoriaEtaria('2024-01-01', today)).toBe('1-4');
      expect(suggestCategoriaEtaria('2021-01-01', today)).toBe('5-9-programado');
      expect(suggestCategoriaEtaria('2016-01-01', today)).toBe('10-14-programado');
      expect(suggestCategoriaEtaria('2011-01-01', today)).toBe('15-19');
      expect(suggestCategoriaEtaria('2000-01-01', today)).toBe('mayor-20');
    });

    it('walks the exact boundaries of the ranges', () => {
      expect(suggestCategoriaEtaria('2025-10-16', today)).toBe('1-4');
      expect(suggestCategoriaEtaria('2021-10-16', today)).toBe('5-9-programado');
      expect(suggestCategoriaEtaria('2016-10-16', today)).toBe('10-14-programado');
      expect(suggestCategoriaEtaria('2011-10-16', today)).toBe('15-19');
      expect(suggestCategoriaEtaria('2006-10-16', today)).toBe('mayor-20');
    });

    it('never suggests the manual "no programado" condition', () => {
      for (let age = 0; age <= 30; age += 1) {
        const birthYear = 2026 - age;

        expect(suggestCategoriaEtaria(`${birthYear}-01-01`, today)).not.toBe(
          '5-14-no-programado',
        );
      }
    });
  });

  describe('FDI tooth predicates', () => {
    it('recognizes permanent teeth (quadrants 1–4, positions 1–8)', () => {
      expect(isPermanentTooth(18)).toBe(true);
      expect(isPermanentTooth(48)).toBe(true);
      expect(isPermanentTooth(55)).toBe(false);
      expect(isPermanentTooth(19)).toBe(false);
    });

    it('recognizes primary teeth (quadrants 5–8, positions 1–5)', () => {
      expect(isPrimaryTooth(51)).toBe(true);
      expect(isPrimaryTooth(85)).toBe(true);
      expect(isPrimaryTooth(86)).toBe(false);
      expect(isPrimaryTooth(11)).toBe(false);
    });
  });

  describe('defaultStateFor', () => {
    it('marks pending work in red and treatments in blue', () => {
      expect(defaultStateFor('caries')).toBe('a-realizar');
      expect(defaultStateFor('extraccion-indicada')).toBe('a-realizar');
      expect(defaultStateFor('sellante-necesario')).toBe('a-realizar');
      expect(defaultStateFor('obturado')).toBe('realizado');
      expect(defaultStateFor('corona')).toBe('realizado');
    });
  });

  describe('chart projection', () => {
    it('lets the latest finding of the same key win and ignores voided ones', () => {
      const older = buildFinding(11, 'caries', { id: 'a', state: 'a-realizar' });
      const newer = buildFinding(11, 'caries', { id: 'b', state: 'realizado' });
      const voided = buildFinding(11, 'caries', { id: 'c', state: 'a-realizar', isVoided: true });

      const active = activeFindings([older, voided, newer]);

      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('b');
    });

    it('keeps findings that differ in surfaces or symbol', () => {
      const mesial = buildFinding(11, 'caries', { id: 'a', surfaces: ['M'] });
      const distal = buildFinding(11, 'caries', { id: 'b', surfaces: ['D'] });
      const occlusal = buildFinding(11, 'obturado', { id: 'c', surfaces: ['O'] });

      expect(activeFindings([mesial, distal, occlusal])).toHaveLength(3);
    });

    it('fills the surfaces painted by surface findings', () => {
      const findings = [
        buildFinding(11, 'caries', { id: 'a', surfaces: ['M', 'D'] }),
        buildFinding(11, 'obturado', { id: 'b', surfaces: ['O'] }),
        buildFinding(11, 'corona', { id: 'c' }),
      ];

      expect(surfaceStates(findings, 11)).toEqual({
        M: 'a-realizar',
        D: 'a-realizar',
        O: 'realizado',
      });
      expect(toothSymbols(findings, 11).map((finding) => finding.id)).toEqual(['c']);
    });

    it('reports the latest recession and mobility grades of the tooth', () => {
      const older = buildFinding(36, 'caries', { id: 'a', surfaces: ['O'], recesion: 1 });
      const newer = buildFinding(36, 'obturado', { id: 'b', surfaces: ['O'], movilidad: 2 });
      const voided = buildFinding(36, 'caries', {
        id: 'c',
        surfaces: ['L'],
        recesion: 3,
        isVoided: true,
      });

      expect(toothGrades([older, voided, newer], 36)).toEqual({ recesion: 1, movilidad: 2 });
    });
  });
});

import {
  computeClinicalIndices,
  toothIndexEffects,
} from './clinical-indices.js';
import { Finding, type FindingSymbol } from './finding.entity.js';
import { HigieneOral } from './higiene-oral.vo.js';

const finding = (
  tooth: number,
  symbol: FindingSymbol,
  extra: Partial<Parameters<typeof Finding.create>[0]> = {},
) =>
  Finding.create({
    recordId: 'record-1',
    tooth,
    symbol,
    createdBy: null,
    ...extra,
  });

describe('clinical indices', () => {
  it('counts each tooth once with loss > caries > treatments', () => {
    const effects = toothIndexEffects([
      finding(16, 'caries'),
      finding(16, 'obturado'),
      finding(26, 'obturado'),
      finding(26, 'corona'),
      finding(36, 'perdida-caries'),
      finding(36, 'caries'),
      finding(46, 'sellante-realizado'),
    ]);

    expect(effects.get(16)).toBe('cariado');
    expect(effects.get(26)).toBe('obturado');
    expect(effects.get(36)).toBe('perdido');
    // Sealants are preventive: they do not count as O.
    expect(effects.has(46)).toBe(false);
  });

  it('ignores voided findings', () => {
    const caries = finding(16, 'caries');
    caries.void(null);

    expect(toothIndexEffects([caries]).size).toBe(0);
  });

  it('separates the permanent (CPO) from the primary (ceo) dentition', () => {
    const indices = computeClinicalIndices(
      [
        finding(16, 'caries'),
        finding(55, 'obturado'),
        finding(85, 'perdida-otra'),
      ],
      HigieneOral.create(null),
    );

    expect(indices.permanentes).toEqual({
      cariados: [16],
      perdidos: [],
      obturados: [],
      total: 1,
    });
    expect(indices.temporales).toEqual({
      cariados: [],
      perdidos: [85],
      obturados: [55],
      total: 2,
    });
  });

  it('sums the hygiene table columns (unrecorded cells do not count)', () => {
    const higiene = HigieneOral.create({
      '16': { placa: 3, calculo: 1, gingivitis: 1 },
      '55': { placa: 2 },
    });

    const indices = computeClinicalIndices([], higiene);

    expect(indices.higieneOral).toEqual({
      placa: 5,
      calculo: 1,
      gingivitis: 1,
      total: 7,
    });
  });
});

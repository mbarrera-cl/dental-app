import {
  isPermanentTooth,
  isPrimaryTooth,
  type Finding,
  type FindingSymbol,
} from './finding.entity.js';
import type { HigieneOral, HigieneOralTotales } from './higiene-oral.vo.js';

/** `C`, `P` and `O` counts (teeth, not surfaces) plus the CPO/ceo total. */
export interface IndexBreakdown {
  cariados: number[];
  perdidos: number[];
  obturados: number[];
  total: number;
}

export interface ClinicalIndices {
  permanentes: IndexBreakdown;
  temporales: IndexBreakdown;
  higieneOral: HigieneOralTotales;
}

export type ToothEffect = 'cariado' | 'perdido' | 'obturado';

/**
 * Symbols that count as the `O` of CPO/ceo. Sealants are preventive
 * treatments, so they are excluded on purpose.
 */
const TREATED_SYMBOLS: readonly FindingSymbol[] = [
  'obturado',
  'corona',
  'endodoncia',
];

/**
 * Chart state is a projection of the append-only log: voided findings are
 * ignored and, for the same tooth + surfaces + symbol, the latest one wins.
 */
export function activeFindings(findings: readonly Finding[]): Finding[] {
  const byKey = new Map<string, Finding>();

  for (const finding of findings) {
    if (finding.isVoided) {
      continue;
    }

    const key = `${finding.tooth}:${[...finding.surfaces].sort().join('')}:${finding.symbol}`;
    const current = byKey.get(key);

    if (current === undefined || finding.createdAt >= current.createdAt) {
      byKey.set(key, finding);
    }
  }

  return [...byKey.values()];
}

/**
 * One effect per tooth (a CPO/ceo tooth is counted once): loss dominates
 * caries, and caries dominates treatments.
 */
export function toothIndexEffects(
  findings: readonly Finding[],
): Map<number, ToothEffect> {
  const byTooth = new Map<number, Finding[]>();

  for (const finding of activeFindings(findings)) {
    const list = byTooth.get(finding.tooth) ?? [];
    list.push(finding);
    byTooth.set(finding.tooth, list);
  }

  const effects = new Map<number, ToothEffect>();

  for (const [tooth, list] of byTooth) {
    const symbols = new Set(list.map((finding) => finding.symbol));

    if (symbols.has('perdida-caries') || symbols.has('perdida-otra')) {
      effects.set(tooth, 'perdido');
    } else if (symbols.has('caries')) {
      effects.set(tooth, 'cariado');
    } else if (TREATED_SYMBOLS.some((symbol) => symbols.has(symbol))) {
      effects.set(tooth, 'obturado');
    }
  }

  return effects;
}

/** CPO (permanent) + ceo (primary) indices derived from the odontogram. */
export function computeClinicalIndices(
  findings: readonly Finding[],
  higieneOral: HigieneOral,
): ClinicalIndices {
  const effects = toothIndexEffects(findings);

  return {
    permanentes: breakdown(effects, isPermanentTooth),
    temporales: breakdown(effects, isPrimaryTooth),
    higieneOral: higieneOral.totales,
  };
}

function breakdown(
  effects: ReadonlyMap<number, ToothEffect>,
  belongsToDentition: (tooth: number) => boolean,
): IndexBreakdown {
  const cariados: number[] = [];
  const perdidos: number[] = [];
  const obturados: number[] = [];

  for (const [tooth, effect] of effects) {
    if (!belongsToDentition(tooth)) {
      continue;
    }

    if (effect === 'cariado') {
      cariados.push(tooth);
    } else if (effect === 'perdido') {
      perdidos.push(tooth);
    } else {
      obturados.push(tooth);
    }
  }

  cariados.sort((a, b) => a - b);
  perdidos.sort((a, b) => a - b);
  obturados.sort((a, b) => a - b);

  return {
    cariados,
    perdidos,
    obturados,
    total: cariados.length + perdidos.length + obturados.length,
  };
}

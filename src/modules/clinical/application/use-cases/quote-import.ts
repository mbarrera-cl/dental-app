import type { Quote } from '../../../quotes/domain/quote.entity.js';
import type { TreatmentPlanItem } from '../../domain/treatment-plan.entity.js';
import { isFdiTooth } from '../../domain/finding.entity.js';

/**
 * Classification of a quotation line when importing it into the plan:
 * - `nuevo`: not present yet (safe to import).
 * - `duplicado`: already imported from this same quotation line.
 * - `ambiguo`: a line with the same UCO code + tooth already exists in the
 *   plan (from another quotation) — the operator decides whether to import it.
 * - `sin-codigo`: no UCO code; imported as free text with a warning.
 */
export type QuoteImportFlag = 'nuevo' | 'duplicado' | 'ambiguo' | 'sin-codigo';

/** Parses a quotation's `pieza_dental` into an FDI tooth, or `null`. */
export function parseTooth(piezaDental: string | null): number | null {
  if (piezaDental === null) {
    return null;
  }

  const digits = piezaDental.replace(/[^0-9]/g, '');

  if (digits === '') {
    return null;
  }

  const tooth = Number(digits);

  return Number.isInteger(tooth) && isFdiTooth(tooth) ? tooth : null;
}

/**
 * Computes the import flag of every non-rejected line of `quote`, given the
 * plan's items (deleted ones included, so a trashed import is not repeated).
 */
export function computeImportFlags(
  quote: Quote,
  existing: readonly TreatmentPlanItem[],
): Map<string, QuoteImportFlag> {
  const importedSources = new Set(
    existing
      .map((item) => item.sourceQuoteItemId)
      .filter((id): id is string => id !== null),
  );
  const activeKeys = new Set(
    existing
      .filter((item) => !item.isDeleted)
      .map((item) => `${item.ucoCode ?? ''}|${item.tooth ?? ''}`),
  );

  const flags = new Map<string, QuoteImportFlag>();

  for (const line of quote.items) {
    if (line.status === 'rechazado') {
      continue;
    }

    if (importedSources.has(line.id)) {
      flags.set(line.id, 'duplicado');
      continue;
    }

    const tooth = parseTooth(line.piezaDental);

    if (line.ucoCode !== null && activeKeys.has(`${line.ucoCode}|${tooth ?? ''}`)) {
      flags.set(line.id, 'ambiguo');
      continue;
    }

    flags.set(line.id, line.ucoCode === null ? 'sin-codigo' : 'nuevo');
  }

  return flags;
}

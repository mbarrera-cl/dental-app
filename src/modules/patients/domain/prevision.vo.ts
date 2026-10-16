import { ValueObject } from '../../../shared/domain/value-object.js';
import { InvalidPrevisionError } from './patient.errors.js';

export const PREVISION_TIPOS = ['FONASA', 'ISAPRE'] as const;

export type PrevisionTipo = (typeof PREVISION_TIPOS)[number];

export const FONASA_TRAMOS = ['A', 'B', 'C', 'D'] as const;

export type FonasaTramo = (typeof FONASA_TRAMOS)[number];

export interface PrevisionProps {
  tipo: PrevisionTipo;
  /** FONASA only; null for ISAPRE. */
  tramo: FonasaTramo | null;
  /** ISAPRE only; null for FONASA. */
  plan: string | null;
}

export interface PrevisionInput {
  tipo: string;
  tramo?: string | null;
  plan?: string | null;
}

export function isFonasaTramo(value: string): value is FonasaTramo {
  return (FONASA_TRAMOS as readonly string[]).includes(value);
}

/**
 * Health coverage value object. Encodes the crossed invariants of the
 * Chilean system: FONASA carries exactly a tramo (A–D), ISAPRE carries
 * exactly a plan name — never both, never neither.
 */
export class Prevision extends ValueObject<PrevisionProps> {
  private constructor(props: PrevisionProps) {
    super(props);
  }

  static create({ tipo, tramo, plan }: PrevisionInput): Prevision {
    const normalizedTipo = tipo.trim().toUpperCase();

    if (normalizedTipo === 'FONASA') {
      if (hasText(plan)) {
        throw new InvalidPrevisionError(
          'FONASA patients must not carry an ISAPRE plan name',
        );
      }

      const normalizedTramo = (tramo ?? '').trim().toUpperCase();

      if (!isFonasaTramo(normalizedTramo)) {
        throw new InvalidPrevisionError(
          'FONASA requires a tramo (A, B, C or D)',
        );
      }

      return new Prevision({
        tipo: 'FONASA',
        tramo: normalizedTramo,
        plan: null,
      });
    }

    if (normalizedTipo === 'ISAPRE') {
      if (hasText(tramo)) {
        throw new InvalidPrevisionError(
          'ISAPRE patients must not carry a FONASA tramo',
        );
      }

      const planName = (plan ?? '').trim();

      if (planName.length === 0) {
        throw new InvalidPrevisionError('ISAPRE requires a plan name');
      }

      return new Prevision({ tipo: 'ISAPRE', tramo: null, plan: planName });
    }

    throw new InvalidPrevisionError('tipo must be "FONASA" or "ISAPRE"');
  }

  get tipo(): PrevisionTipo {
    return this.props.tipo;
  }

  get tramo(): FonasaTramo | null {
    return this.props.tramo;
  }

  get plan(): string | null {
    return this.props.plan;
  }
}

function hasText(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && value.trim().length > 0;
}

import { ValueObject } from '../../../shared/domain/value-object.js';
import { InvalidPrevisionError } from './patient.errors.js';

export const PREVISION_TIPOS = [
  'FONASA',
  'ISAPRE',
  'PARTICULAR',
  'CONVENIO',
] as const;

export type PrevisionTipo = (typeof PREVISION_TIPOS)[number];

export const FONASA_TRAMOS = ['A', 'B', 'C', 'D'] as const;

export type FonasaTramo = (typeof FONASA_TRAMOS)[number];

export interface PrevisionProps {
  tipo: PrevisionTipo;
  /** FONASA only; null for every other type. */
  tramo: FonasaTramo | null;
  /** ISAPRE only; null for every other type. */
  plan: string | null;
  /** CONVENIO only; null for every other type. */
  convenio: string | null;
}

export interface PrevisionInput {
  tipo: string;
  tramo?: string | null;
  plan?: string | null;
  convenio?: string | null;
}

export function isFonasaTramo(value: string): value is FonasaTramo {
  return (FONASA_TRAMOS as readonly string[]).includes(value);
}

/**
 * Health coverage value object. Encodes the crossed invariants of the
 * Chilean system: FONASA carries exactly a tramo (A–D), ISAPRE exactly a
 * plan name, CONVENIO exactly an agreement name, and PARTICULAR carries no
 * coverage details at all — never both, never neither.
 */
export class Prevision extends ValueObject<PrevisionProps> {
  private constructor(props: PrevisionProps) {
    super(props);
  }

  static create({ tipo, tramo, plan, convenio }: PrevisionInput): Prevision {
    const normalizedTipo = tipo.trim().toUpperCase();

    if (normalizedTipo === 'FONASA') {
      if (hasText(plan)) {
        throw new InvalidPrevisionError(
          'FONASA patients must not carry an ISAPRE plan name',
        );
      }

      if (hasText(convenio)) {
        throw new InvalidPrevisionError(
          'FONASA patients must not carry a convenio name',
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
        convenio: null,
      });
    }

    if (normalizedTipo === 'ISAPRE') {
      if (hasText(tramo)) {
        throw new InvalidPrevisionError(
          'ISAPRE patients must not carry a FONASA tramo',
        );
      }

      if (hasText(convenio)) {
        throw new InvalidPrevisionError(
          'ISAPRE patients must not carry a convenio name',
        );
      }

      const planName = (plan ?? '').trim();

      if (planName.length === 0) {
        throw new InvalidPrevisionError('ISAPRE requires a plan name');
      }

      return new Prevision({
        tipo: 'ISAPRE',
        tramo: null,
        plan: planName,
        convenio: null,
      });
    }

    if (normalizedTipo === 'PARTICULAR') {
      if (hasText(tramo) || hasText(plan) || hasText(convenio)) {
        throw new InvalidPrevisionError(
          'PARTICULAR patients must not carry coverage details',
        );
      }

      return new Prevision({
        tipo: 'PARTICULAR',
        tramo: null,
        plan: null,
        convenio: null,
      });
    }

    if (normalizedTipo === 'CONVENIO') {
      if (hasText(tramo) || hasText(plan)) {
        throw new InvalidPrevisionError(
          'CONVENIO patients must not carry a tramo or an ISAPRE plan',
        );
      }

      const convenioName = (convenio ?? '').trim();

      if (convenioName.length === 0) {
        throw new InvalidPrevisionError('CONVENIO requires a convenio name');
      }

      return new Prevision({
        tipo: 'CONVENIO',
        tramo: null,
        plan: null,
        convenio: convenioName,
      });
    }

    throw new InvalidPrevisionError(
      'tipo must be "FONASA", "ISAPRE", "PARTICULAR" or "CONVENIO"',
    );
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

  get convenio(): string | null {
    return this.props.convenio;
  }
}

function hasText(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && value.trim().length > 0;
}

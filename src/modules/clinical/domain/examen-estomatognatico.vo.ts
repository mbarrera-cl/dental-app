import { ValueObject } from '../../../shared/domain/value-object.js';
import { InvalidExamenEstomatognaticoError } from './clinical.errors.js';

/** The twelve regions explored during the stomatognathic exam. */
export const REGIONES_ESTOMATOGNATICAS = [
  'labios',
  'mejillas',
  'maxilar-superior',
  'maxilar-inferior',
  'lengua',
  'paladar',
  'piso',
  'carrillos',
  'glandulas-salivales',
  'oro-faringe',
  'atm',
  'ganglios',
] as const;

export type RegionEstomatognatica = (typeof REGIONES_ESTOMATOGNATICAS)[number];

export type EstadoRegion = 'normal' | 'alterado';

export type RegionesRecord = Record<RegionEstomatognatica, EstadoRegion | null>;

export interface ExamenEstomatognaticoInput {
  regiones?: Partial<Record<RegionEstomatognatica, string | null>>;
  descripcion?: string | null;
}

const MAX_DESCRIPCION_LENGTH = 2000;

/**
 * Stomatognathic exam: per-region verdict (null = not explored yet) plus the
 * free-text description of the affected region — the form asks to note the
 * number of the region being described.
 */
export class ExamenEstomatognatico extends ValueObject<{
  regiones: RegionesRecord;
  descripcion: string | null;
}> {
  private constructor(regiones: RegionesRecord, descripcion: string | null) {
    super({ regiones, descripcion });
  }

  static create(
    input: ExamenEstomatognaticoInput | null | undefined = {},
  ): ExamenEstomatognatico {
    const source = input ?? {};
    const rawRegiones = source.regiones ?? {};

    for (const key of Object.keys(rawRegiones)) {
      if (!(REGIONES_ESTOMATOGNATICAS as readonly string[]).includes(key)) {
        throw new InvalidExamenEstomatognaticoError(`unknown region "${key}"`);
      }
    }

    const regiones = {} as RegionesRecord;

    for (const region of REGIONES_ESTOMATOGNATICAS) {
      regiones[region] = normalizeEstado(rawRegiones[region], region);
    }

    return new ExamenEstomatognatico(
      regiones,
      normalizeDescripcion(source.descripcion),
    );
  }

  get regiones(): Readonly<RegionesRecord> {
    return this.props.regiones;
  }

  get descripcion(): string | null {
    return this.props.descripcion;
  }

  toJSON(): { regiones: RegionesRecord; descripcion: string | null } {
    return { regiones: this.props.regiones, descripcion: this.props.descripcion };
  }
}

function normalizeEstado(
  value: string | null | undefined,
  region: string,
): EstadoRegion | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value !== 'normal' && value !== 'alterado') {
    throw new InvalidExamenEstomatognaticoError(
      `estado of "${region}" must be normal or alterado`,
    );
  }

  return value;
}

function normalizeDescripcion(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new InvalidExamenEstomatognaticoError('descripcion must be a string');
  }

  const trimmed = value.trim();

  if (trimmed.length > MAX_DESCRIPCION_LENGTH) {
    throw new InvalidExamenEstomatognaticoError(
      `descripcion must have at most ${MAX_DESCRIPCION_LENGTH} characters`,
    );
  }

  return trimmed.length === 0 ? null : trimmed;
}

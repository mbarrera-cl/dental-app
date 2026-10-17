import { ValueObject } from '../../../shared/domain/value-object.js';
import { InvalidIndicadoresError } from './clinical.errors.js';
import {
  HigieneOral,
  type HigieneOralInput,
  type HigieneOralRecord,
} from './higiene-oral.vo.js';

export const ENFERMEDAD_PERIODONTAL = ['leve', 'moderada', 'severa'] as const;
export type EnfermedadPeriodontal = (typeof ENFERMEDAD_PERIODONTAL)[number];

export const MALOCLUSIONES = ['angle-i', 'angle-ii', 'angle-iii'] as const;
export type Maloclusion = (typeof MALOCLUSIONES)[number];

export const GRADOS_FLUOROSIS = ['leve', 'moderada', 'severa'] as const;
export type GradoFluorosis = (typeof GRADOS_FLUOROSIS)[number];

export interface IndicadoresSaludBucalInput {
  higieneOral?: HigieneOralInput | null;
  enfermedadPeriodontal?: string | null;
  maloclusion?: string | null;
  fluorosis?: string | null;
}

export interface IndicadoresSaludBucalJSON {
  higieneOral: HigieneOralRecord;
  enfermedadPeriodontal: EnfermedadPeriodontal | null;
  maloclusion: Maloclusion | null;
  fluorosis: GradoFluorosis | null;
}

/**
 * Oral health indicators block of the form: the simplified hygiene table plus
 * the periodontal disease, malocclusion and fluorosis verdicts. The CPO/ceo
 * indices are *not* here — they are derived from the odontogram.
 */
export class IndicadoresSaludBucal extends ValueObject<{
  higieneOral: HigieneOral;
  enfermedadPeriodontal: EnfermedadPeriodontal | null;
  maloclusion: Maloclusion | null;
  fluorosis: GradoFluorosis | null;
}> {
  private constructor(props: {
    higieneOral: HigieneOral;
    enfermedadPeriodontal: EnfermedadPeriodontal | null;
    maloclusion: Maloclusion | null;
    fluorosis: GradoFluorosis | null;
  }) {
    super(props);
  }

  static create(
    input: IndicadoresSaludBucalInput | null | undefined = {},
  ): IndicadoresSaludBucal {
    const source = input ?? {};

    return new IndicadoresSaludBucal({
      higieneOral: HigieneOral.create(source.higieneOral ?? null),
      enfermedadPeriodontal: optionalEnum(
        source.enfermedadPeriodontal,
        ENFERMEDAD_PERIODONTAL,
        'enfermedadPeriodontal',
      ),
      maloclusion: optionalEnum(source.maloclusion, MALOCLUSIONES, 'maloclusion'),
      fluorosis: optionalEnum(source.fluorosis, GRADOS_FLUOROSIS, 'fluorosis'),
    });
  }

  get higieneOral(): HigieneOral {
    return this.props.higieneOral;
  }

  get enfermedadPeriodontal(): EnfermedadPeriodontal | null {
    return this.props.enfermedadPeriodontal;
  }

  get maloclusion(): Maloclusion | null {
    return this.props.maloclusion;
  }

  get fluorosis(): GradoFluorosis | null {
    return this.props.fluorosis;
  }

  toJSON(): IndicadoresSaludBucalJSON {
    return {
      higieneOral: this.props.higieneOral.toJSON(),
      enfermedadPeriodontal: this.props.enfermedadPeriodontal,
      maloclusion: this.props.maloclusion,
      fluorosis: this.props.fluorosis,
    };
  }
}

function optionalEnum<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  field: string,
): T | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (!(allowed as readonly string[]).includes(value)) {
    throw new InvalidIndicadoresError(
      `${field} must be one of: ${allowed.join(', ')}`,
    );
  }

  return value as T;
}

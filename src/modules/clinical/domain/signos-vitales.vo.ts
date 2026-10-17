import { ValueObject } from '../../../shared/domain/value-object.js';
import { InvalidSignosVitalesError } from './clinical.errors.js';

export interface SignosVitalesInput {
  presionArterialSistolica?: number | null;
  presionArterialDiastolica?: number | null;
  frecuenciaCardiaca?: number | null;
  temperatura?: number | null;
  frecuenciaRespiratoria?: number | null;
}

export interface SignosVitalesProps {
  presionArterialSistolica: number | null;
  presionArterialDiastolica: number | null;
  frecuenciaCardiaca: number | null;
  temperatura: number | null;
  frecuenciaRespiratoria: number | null;
}

/**
 * Vital signs of one visit. Every value is optional (they can be measured
 * later); pressure is stored as two integers so the `120/80` invariant
 * (systolic > diastolic) is enforceable.
 */
export class SignosVitales extends ValueObject<SignosVitalesProps> {
  private constructor(props: SignosVitalesProps) {
    super(props);
  }

  static create(input: SignosVitalesInput | null | undefined = {}): SignosVitales {
    const source = input ?? {};

    const sistolica = optionalInteger(
      source.presionArterialSistolica,
      40,
      300,
      'presionArterialSistolica',
    );
    const diastolica = optionalInteger(
      source.presionArterialDiastolica,
      20,
      200,
      'presionArterialDiastolica',
    );

    if ((sistolica === null) !== (diastolica === null)) {
      throw new InvalidSignosVitalesError(
        'presion arterial needs both the systolic and the diastolic value',
      );
    }

    if (sistolica !== null && diastolica !== null && sistolica <= diastolica) {
      throw new InvalidSignosVitalesError(
        'systolic pressure must be greater than diastolic pressure',
      );
    }

    return new SignosVitales({
      presionArterialSistolica: sistolica,
      presionArterialDiastolica: diastolica,
      frecuenciaCardiaca: optionalInteger(
        source.frecuenciaCardiaca,
        20,
        250,
        'frecuenciaCardiaca',
      ),
      temperatura: optionalTemperature(source.temperatura),
      frecuenciaRespiratoria: optionalInteger(
        source.frecuenciaRespiratoria,
        4,
        80,
        'frecuenciaRespiratoria',
      ),
    });
  }

  get presionArterialSistolica(): number | null {
    return this.props.presionArterialSistolica;
  }

  get presionArterialDiastolica(): number | null {
    return this.props.presionArterialDiastolica;
  }

  get frecuenciaCardiaca(): number | null {
    return this.props.frecuenciaCardiaca;
  }

  get temperatura(): number | null {
    return this.props.temperatura;
  }

  get frecuenciaRespiratoria(): number | null {
    return this.props.frecuenciaRespiratoria;
  }

  toJSON(): SignosVitalesProps {
    return { ...this.props };
  }
}

function optionalInteger(
  value: number | null | undefined,
  min: number,
  max: number,
  field: string,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isInteger(value) || value < min || value > max) {
    throw new InvalidSignosVitalesError(
      `${field} must be an integer between ${min} and ${max}`,
    );
  }

  return value;
}

function optionalTemperature(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'number' || Number.isNaN(value) || value < 30 || value > 45) {
    throw new InvalidSignosVitalesError(
      'temperatura must be a number between 30 and 45 degrees Celsius',
    );
  }

  // One decimal is the resolution of every clinical thermometer.
  return Math.round(value * 10) / 10;
}

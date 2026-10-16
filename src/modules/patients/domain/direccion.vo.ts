import { ValueObject } from '../../../shared/domain/value-object.js';
import { InvalidDireccionError } from './patient.errors.js';
import { Region, type RegionCode } from './region.js';

export interface DireccionProps {
  region: RegionCode;
  comuna: string;
  calle: string;
  numero: string;
  departamento: string | null;
}

export interface DireccionInput {
  region: string;
  comuna: string;
  calle: string;
  numero: string;
  departamento?: string | null;
}

/**
 * Chilean address value object. `comuna` stays free text on purpose (there
 * are 346 of them and the catalog changes); the region is validated against
 * the 16 official codes.
 */
export class Direccion extends ValueObject<DireccionProps> {
  private constructor(props: DireccionProps) {
    super(props);
  }

  static create(input: DireccionInput): Direccion {
    return new Direccion({
      region: Region.create(input.region).value,
      comuna: requiredText(input.comuna, 'comuna'),
      calle: requiredText(input.calle, 'calle'),
      numero: requiredText(input.numero, 'numero'),
      departamento: optionalText(input.departamento),
    });
  }

  get region(): RegionCode {
    return this.props.region;
  }

  get comuna(): string {
    return this.props.comuna;
  }

  get calle(): string {
    return this.props.calle;
  }

  get numero(): string {
    return this.props.numero;
  }

  get departamento(): string | null {
    return this.props.departamento;
  }
}

function requiredText(value: string, field: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new InvalidDireccionError(field);
  }

  return trimmed;
}

function optionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

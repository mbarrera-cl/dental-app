import { Telefono } from '../../../shared/domain/telefono.vo.js';
import { ValueObject } from '../../../shared/domain/value-object.js';
import { InvalidContactoEmergenciaError } from './patient.errors.js';

export interface ContactoEmergenciaProps {
  nombre: string;
  /** Canonical `+56912345678` form. */
  telefono: string;
  parentesco: string | null;
}

export interface ContactoEmergenciaInput {
  nombre: string;
  telefono: string;
  parentesco?: string | null;
}

/** Emergency contact: name, Chilean phone and optional relationship. */
export class ContactoEmergencia extends ValueObject<ContactoEmergenciaProps> {
  private constructor(props: ContactoEmergenciaProps) {
    super(props);
  }

  static create(input: ContactoEmergenciaInput): ContactoEmergencia {
    const nombre = input.nombre.trim();

    if (nombre.length === 0) {
      throw new InvalidContactoEmergenciaError('nombre');
    }

    return new ContactoEmergencia({
      nombre,
      telefono: Telefono.create(input.telefono).value,
      parentesco: normalizeParentesco(input.parentesco),
    });
  }

  get nombre(): string {
    return this.props.nombre;
  }

  get telefono(): string {
    return this.props.telefono;
  }

  get parentesco(): string | null {
    return this.props.parentesco;
  }
}

function normalizeParentesco(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

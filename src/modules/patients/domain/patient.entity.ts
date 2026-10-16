import { Entity } from '../../../shared/domain/entity.js';
import {
  ContactoEmergencia,
  type ContactoEmergenciaInput,
} from './contacto-emergencia.vo.js';
import { Direccion, type DireccionInput } from './direccion.vo.js';
import { Email } from './email.vo.js';
import { FechaNacimiento } from './fecha-nacimiento.vo.js';
import { InvalidPatientNameError, InvalidSexoError } from './patient.errors.js';
import { Prevision, type PrevisionInput } from './prevision.vo.js';
import { Rut } from './rut.vo.js';
import { Telefono } from './telefono.vo.js';

export const SEXOS = ['femenino', 'masculino', 'otro'] as const;

export type Sexo = (typeof SEXOS)[number];

export interface PatientProps {
  rut: Rut;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento: FechaNacimiento;
  sexo: Sexo;
  email: Email | null;
  telefono: Telefono | null;
  direccion: Direccion | null;
  prevision: Prevision | null;
  contactoEmergencia: ContactoEmergencia | null;
  notas: string | null;
  createdAt: Date;
}

export interface CreatePatientProps {
  rut: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento: string;
  sexo: string;
  email?: string | null;
  telefono?: string | null;
  direccion?: DireccionInput | null;
  prevision?: PrevisionInput | null;
  contactoEmergencia?: ContactoEmergenciaInput | null;
  notas?: string | null;
}

/**
 * Patient aggregate root for the dental clinic. The RUT is the business
 * key (validated, canonical `12345678-5`); the inherited `id` stays as the
 * technical key.
 */
export class Patient extends Entity<PatientProps> {
  private constructor(props: PatientProps, id?: string) {
    super(props, id);
  }

  static create({
    rut,
    nombres,
    apellidoPaterno,
    apellidoMaterno,
    fechaNacimiento,
    sexo,
    email,
    telefono,
    direccion,
    prevision,
    contactoEmergencia,
    notas,
  }: CreatePatientProps): Patient {
    return new Patient({
      rut: Rut.create(rut),
      nombres: Patient.normalizeName(nombres, 'nombres'),
      apellidoPaterno: Patient.normalizeName(
        apellidoPaterno,
        'apellidoPaterno',
      ),
      apellidoMaterno: Patient.normalizeName(
        apellidoMaterno,
        'apellidoMaterno',
      ),
      fechaNacimiento: FechaNacimiento.create(fechaNacimiento),
      sexo: Patient.normalizeSexo(sexo),
      email: email === null || email === undefined ? null : Email.create(email),
      telefono:
        telefono === null || telefono === undefined
          ? null
          : Telefono.create(telefono),
      direccion:
        direccion === null || direccion === undefined
          ? null
          : Direccion.create(direccion),
      prevision:
        prevision === null || prevision === undefined
          ? null
          : Prevision.create(prevision),
      contactoEmergencia:
        contactoEmergencia === null || contactoEmergencia === undefined
          ? null
          : ContactoEmergencia.create(contactoEmergencia),
      notas: Patient.normalizeNotas(notas),
      createdAt: new Date(),
    });
  }

  /** Rebuilds a patient that already exists (e.g. loaded from a database). */
  static reconstitute(props: PatientProps, id: string): Patient {
    return new Patient(props, id);
  }

  get rut(): string {
    return this.props.rut.value;
  }

  get nombres(): string {
    return this.props.nombres;
  }

  get apellidoPaterno(): string {
    return this.props.apellidoPaterno;
  }

  get apellidoMaterno(): string {
    return this.props.apellidoMaterno;
  }

  get nombreCompleto(): string {
    return `${this.props.nombres} ${this.props.apellidoPaterno} ${this.props.apellidoMaterno}`;
  }

  get fechaNacimiento(): string {
    return this.props.fechaNacimiento.value;
  }

  get sexo(): Sexo {
    return this.props.sexo;
  }

  get email(): string | null {
    return this.props.email?.value ?? null;
  }

  get telefono(): string | null {
    return this.props.telefono?.value ?? null;
  }

  get direccion(): Direccion | null {
    return this.props.direccion;
  }

  get prevision(): Prevision | null {
    return this.props.prevision;
  }

  get contactoEmergencia(): ContactoEmergencia | null {
    return this.props.contactoEmergencia;
  }

  get notas(): string | null {
    return this.props.notas;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  /** Mutators enforce the same invariants as `create`. */
  changeRut(rut: Rut): void {
    this.props.rut = rut;
  }

  changeNombres(nombres: string): void {
    this.props.nombres = Patient.normalizeName(nombres, 'nombres');
  }

  changeApellidoPaterno(apellidoPaterno: string): void {
    this.props.apellidoPaterno = Patient.normalizeName(
      apellidoPaterno,
      'apellidoPaterno',
    );
  }

  changeApellidoMaterno(apellidoMaterno: string): void {
    this.props.apellidoMaterno = Patient.normalizeName(
      apellidoMaterno,
      'apellidoMaterno',
    );
  }

  changeFechaNacimiento(fechaNacimiento: FechaNacimiento): void {
    this.props.fechaNacimiento = fechaNacimiento;
  }

  changeSexo(sexo: string): void {
    this.props.sexo = Patient.normalizeSexo(sexo);
  }

  changeEmail(email: Email | null): void {
    this.props.email = email;
  }

  changeTelefono(telefono: Telefono | null): void {
    this.props.telefono = telefono;
  }

  changeDireccion(direccion: Direccion | null): void {
    this.props.direccion = direccion;
  }

  changePrevision(prevision: Prevision | null): void {
    this.props.prevision = prevision;
  }

  changeContactoEmergencia(
    contactoEmergencia: ContactoEmergencia | null,
  ): void {
    this.props.contactoEmergencia = contactoEmergencia;
  }

  changeNotas(notas: string | null): void {
    this.props.notas = Patient.normalizeNotas(notas);
  }

  private static normalizeName(value: string, field: string): string {
    const normalized = value.trim();

    if (normalized.length === 0) {
      throw new InvalidPatientNameError(field);
    }

    return normalized;
  }

  private static normalizeSexo(value: string): Sexo {
    const normalized = value.trim().toLowerCase();

    if (!(SEXOS as readonly string[]).includes(normalized)) {
      throw new InvalidSexoError(value);
    }

    return normalized as Sexo;
  }

  private static normalizeNotas(
    value: string | null | undefined,
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
}

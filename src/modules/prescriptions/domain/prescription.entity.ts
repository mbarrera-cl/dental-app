import { Entity } from '../../../shared/domain/entity.js';
import { InvalidPrescriptionError } from './prescription.errors.js';

export interface PrescriptionItemProps {
  medicamento: string;
  dosis: string;
  frecuencia: string;
  duracion: string;
}

export type PrescriptionItemInput = PrescriptionItemProps;

const MAX_ITEM_FIELD_LENGTH = 200;
const MAX_INDICACIONES_LENGTH = 2000;
const MAX_NAME_LENGTH = 300;

/**
 * One prescribed medication. Free text on purpose: a Chilean dentist
 * prescribes antibiotics, analgesics and rinses by hand, so a closed catalog
 * would get in the way.
 */
export class PrescriptionItem {
  private constructor(private readonly props: PrescriptionItemProps) {}

  static create(input: PrescriptionItemInput): PrescriptionItem {
    return new PrescriptionItem({
      medicamento: requireText(input.medicamento, 'medicamento', MAX_ITEM_FIELD_LENGTH),
      dosis: requireText(input.dosis, 'dosis', MAX_ITEM_FIELD_LENGTH),
      frecuencia: requireText(input.frecuencia, 'frecuencia', MAX_ITEM_FIELD_LENGTH),
      duracion: requireText(input.duracion, 'duracion', MAX_ITEM_FIELD_LENGTH),
    });
  }

  get medicamento(): string {
    return this.props.medicamento;
  }

  get dosis(): string {
    return this.props.dosis;
  }

  get frecuencia(): string {
    return this.props.frecuencia;
  }

  get duracion(): string {
    return this.props.duracion;
  }

  toJSON(): PrescriptionItemProps {
    return { ...this.props };
  }
}

export interface PrescriptionProps {
  patientId: string;
  patientName: string;
  patientRut: string;
  items: PrescriptionItem[];
  indicaciones: string | null;
  issuedBy: string | null;
  issuedByName: string;
  issuedAt: Date;
  createdAt: Date;
}

export interface CreatePrescriptionProps {
  patientId: string;
  patientName: string;
  patientRut: string;
  items: PrescriptionItemInput[];
  indicaciones?: string | null;
  issuedBy: string | null;
  issuedByName: string;
  now?: Date;
}

/**
 * A printed prescription (receta). Like a quote, it snapshots the patient and
 * the professional so the document keeps reading the same even if the patient
 * record changes later.
 */
export class Prescription extends Entity<PrescriptionProps> {
  private constructor(props: PrescriptionProps, id?: string) {
    super(props, id);
  }

  static create({
    patientId,
    patientName,
    patientRut,
    items,
    indicaciones,
    issuedBy,
    issuedByName,
    now,
  }: CreatePrescriptionProps): Prescription {
    if (items.length === 0) {
      throw new InvalidPrescriptionError('at least one medication is required');
    }

    const issuedAt = now ?? new Date();

    return new Prescription({
      patientId: requireText(patientId, 'patientId', MAX_NAME_LENGTH),
      patientName: requireText(patientName, 'patientName', MAX_NAME_LENGTH),
      patientRut: requireText(patientRut, 'patientRut', 20),
      items: items.map((item) => PrescriptionItem.create(item)),
      indicaciones: normalizeText(indicaciones, 'indicaciones', MAX_INDICACIONES_LENGTH),
      issuedBy,
      issuedByName: requireText(issuedByName, 'issuedByName', MAX_NAME_LENGTH),
      issuedAt,
      createdAt: issuedAt,
    });
  }

  static reconstitute(props: PrescriptionProps, id: string): Prescription {
    return new Prescription(props, id);
  }

  get patientId(): string {
    return this.props.patientId;
  }

  get patientName(): string {
    return this.props.patientName;
  }

  get patientRut(): string {
    return this.props.patientRut;
  }

  get items(): readonly PrescriptionItem[] {
    return this.props.items;
  }

  get indicaciones(): string | null {
    return this.props.indicaciones;
  }

  get issuedBy(): string | null {
    return this.props.issuedBy;
  }

  get issuedByName(): string {
    return this.props.issuedByName;
  }

  get issuedAt(): Date {
    return this.props.issuedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}

function requireText(value: string, field: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new InvalidPrescriptionError(`"${field}" must be a string`);
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new InvalidPrescriptionError(`"${field}" must not be empty`);
  }

  if (trimmed.length > maxLength) {
    throw new InvalidPrescriptionError(
      `"${field}" must have at most ${maxLength} characters`,
    );
  }

  return trimmed;
}

function normalizeText(
  value: string | null | undefined,
  field: string,
  maxLength: number,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return value.trim() === ''
    ? null
    : requireText(value, field, maxLength);
}

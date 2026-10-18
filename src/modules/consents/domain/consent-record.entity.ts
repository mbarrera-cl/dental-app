import { Entity } from '../../../shared/domain/entity.js';
import { ConsentTemplate } from './consent-template.entity.js';
import { InvalidConsentError } from './consent.errors.js';

export interface ConsentRecordProps {
  patientId: string;
  patientName: string;
  patientRut: string;
  templateId: string | null;
  templateKey: string;
  templateVersion: number;
  title: string;
  body: string;
  procedure: string | null;
  acceptorName: string;
  acceptedAt: Date;
  recordedBy: string | null;
  createdAt: Date;
}

export interface CreateConsentRecordProps {
  template: ConsentTemplate;
  patientId: string;
  patientName: string;
  patientRut: string;
  procedure?: string | null;
  acceptorName: string;
  recordedBy: string | null;
  now?: Date;
}

const MAX_NAME_LENGTH = 300;
const MAX_RUT_LENGTH = 20;
const MAX_PROCEDURE_LENGTH = 300;

/**
 * One accepted informed consent. Append-only: the template snapshot (key,
 * version, title and body) is frozen when the patient accepts, so later edits
 * to the template never rewrite history.
 */
export class ConsentRecord extends Entity<ConsentRecordProps> {
  private constructor(props: ConsentRecordProps, id?: string) {
    super(props, id);
  }

  static create({
    template,
    patientId,
    patientName,
    patientRut,
    procedure,
    acceptorName,
    recordedBy,
    now,
  }: CreateConsentRecordProps): ConsentRecord {
    const acceptedAt = now ?? new Date();

    return new ConsentRecord({
      patientId: requireText(patientId, 'patientId', MAX_NAME_LENGTH),
      patientName: requireText(patientName, 'patientName', MAX_NAME_LENGTH),
      patientRut: requireText(patientRut, 'patientRut', MAX_RUT_LENGTH),
      templateId: template.id,
      templateKey: template.key,
      templateVersion: template.version,
      title: template.title,
      body: template.body,
      procedure: normalizeText(procedure, 'procedure', MAX_PROCEDURE_LENGTH),
      acceptorName: requireText(acceptorName, 'acceptorName', MAX_NAME_LENGTH),
      acceptedAt,
      recordedBy,
      createdAt: acceptedAt,
    });
  }

  static reconstitute(props: ConsentRecordProps, id: string): ConsentRecord {
    return new ConsentRecord(props, id);
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

  get templateId(): string | null {
    return this.props.templateId;
  }

  get templateKey(): string {
    return this.props.templateKey;
  }

  get templateVersion(): number {
    return this.props.templateVersion;
  }

  get title(): string {
    return this.props.title;
  }

  get body(): string {
    return this.props.body;
  }

  get procedure(): string | null {
    return this.props.procedure;
  }

  get acceptorName(): string {
    return this.props.acceptorName;
  }

  get acceptedAt(): Date {
    return this.props.acceptedAt;
  }

  get recordedBy(): string | null {
    return this.props.recordedBy;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}

function requireText(value: string, field: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new InvalidConsentError(`"${field}" must be a string`);
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new InvalidConsentError(`"${field}" must not be empty`);
  }

  if (trimmed.length > maxLength) {
    throw new InvalidConsentError(
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

  return value.trim() === '' ? null : requireText(value, field, maxLength);
}

import { Entity } from '../../../shared/domain/entity.js';

/** Everything worth auditing in the record happens through these actions. */
export const CLINICAL_EVENT_ACTIONS = [
  'ficha-creada',
  'ficha-actualizada',
  'ficha-finalizada',
  'hallazgo-agregado',
  'hallazgo-anulado',
  'plan-item-agregado',
  'plan-item-actualizado',
] as const;

export type ClinicalEventAction = (typeof CLINICAL_EVENT_ACTIONS)[number];

export interface ClinicalEventProps {
  patientId: string;
  recordId: string;
  actorId: string | null;
  action: ClinicalEventAction;
  summary: string | null;
  payload: Record<string, unknown> | null;
  createdAt: Date;
}

export interface CreateClinicalEventProps {
  patientId: string;
  recordId: string;
  actorId: string | null;
  action: ClinicalEventAction;
  summary?: string | null;
  payload?: Record<string, unknown> | null;
}

/**
 * Clinical timeline entry and audit record in one: who did what, when, with
 * a stable machine-readable payload. Appended by the use cases, never edited.
 */
export class ClinicalEvent extends Entity<ClinicalEventProps> {
  private constructor(props: ClinicalEventProps, id?: string) {
    super(props, id);
  }

  static create({
    patientId,
    recordId,
    actorId,
    action,
    summary = null,
    payload = null,
  }: CreateClinicalEventProps): ClinicalEvent {
    return new ClinicalEvent({
      patientId,
      recordId,
      actorId,
      action,
      summary,
      payload,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: ClinicalEventProps, id: string): ClinicalEvent {
    return new ClinicalEvent(props, id);
  }

  get patientId(): string {
    return this.props.patientId;
  }

  get recordId(): string {
    return this.props.recordId;
  }

  get actorId(): string | null {
    return this.props.actorId;
  }

  get action(): ClinicalEventAction {
    return this.props.action;
  }

  get summary(): string | null {
    return this.props.summary;
  }

  get payload(): Record<string, unknown> | null {
    return this.props.payload;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}

import { Entity } from '../../../shared/domain/entity.js';
import { InvalidAgendaReasonError } from './appointment.errors.js';

export interface AgendaReasonProps {
  name: string;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class AgendaReason extends Entity<AgendaReasonProps> {
  private constructor(props: AgendaReasonProps, id?: string) {
    super(props, id);
  }

  static create(input: { name: string; createdBy?: string | null; now?: Date }): AgendaReason {
    const now = input.now ?? new Date();
    const name = AgendaReason.normalizeName(input.name);

    return new AgendaReason({
      name,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: AgendaReasonProps, id: string): AgendaReason {
    return new AgendaReason(props, id);
  }

  get name(): string {
    return this.props.name;
  }

  get createdBy(): string | null {
    return this.props.createdBy;
  }

  get updatedBy(): string | null {
    return this.props.updatedBy;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  rename(name: string, actorId: string | null, now = new Date()): void {
    this.props.name = AgendaReason.normalizeName(name);
    this.props.updatedBy = actorId;
    this.props.updatedAt = now;
  }

  private static normalizeName(value: string): string {
    const name = value.trim();

    if (name.length < 2 || name.length > 80) {
      throw new InvalidAgendaReasonError('name must have between 2 and 80 characters');
    }

    return name;
  }
}

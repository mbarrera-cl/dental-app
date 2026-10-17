import { Entity } from '../../../shared/domain/entity.js';
import {
  AppointmentNotFoundError,
  InvalidAppointmentRangeError,
} from './appointment.errors.js';

export const APPOINTMENT_STATUSES = ['scheduled', 'cancelled', 'completed', 'no_show'] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

const MAX_DURATION_MS = 12 * 60 * 60 * 1000;
const MAX_TEXT_LENGTH = 2000;

export interface AppointmentProps {
  patientId: string;
  professionalId: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  reason: string | null;
  notes: string | null;
  location: string | null;
  icsSequence: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  cancelledAt: Date | null;
  cancelledBy: string | null;
}

export interface CreateAppointmentProps {
  patientId: string;
  professionalId: string;
  startsAt: Date;
  endsAt: Date;
  reason?: string | null;
  notes?: string | null;
  location?: string | null;
  createdBy?: string | null;
  now?: Date;
}

export interface UpdateAppointmentProps {
  patientId?: string;
  professionalId?: string;
  startsAt?: Date;
  endsAt?: Date;
  reason?: string | null;
  notes?: string | null;
  location?: string | null;
  actorId?: string | null;
}

/**
 * A scheduled appointment. The first version deliberately does not model
 * availability or slots: any valid range can be booked. The application layer
 * only reports overlaps as warnings.
 */
export class Appointment extends Entity<AppointmentProps> {
  private constructor(props: AppointmentProps, id?: string) {
    super(props, id);
  }

  static create(input: CreateAppointmentProps): Appointment {
    const now = input.now ?? new Date();
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);

    Appointment.assertRange(startsAt, endsAt);

    return new Appointment({
      patientId: input.patientId,
      professionalId: input.professionalId,
      startsAt,
      endsAt,
      status: 'scheduled',
      reason: normalizeText(input.reason),
      notes: normalizeText(input.notes),
      location: normalizeText(input.location),
      icsSequence: 0,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
      cancelledAt: null,
      cancelledBy: null,
    });
  }

  static reconstitute(props: AppointmentProps, id: string): Appointment {
    return new Appointment(props, id);
  }

  get patientId(): string {
    return this.props.patientId;
  }

  get professionalId(): string {
    return this.props.professionalId;
  }

  get startsAt(): Date {
    return this.props.startsAt;
  }

  get endsAt(): Date {
    return this.props.endsAt;
  }

  get status(): AppointmentStatus {
    return this.props.status;
  }

  get reason(): string | null {
    return this.props.reason;
  }

  get notes(): string | null {
    return this.props.notes;
  }

  get location(): string | null {
    return this.props.location;
  }

  get icsSequence(): number {
    return this.props.icsSequence;
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

  get cancelledAt(): Date | null {
    return this.props.cancelledAt;
  }

  get cancelledBy(): string | null {
    return this.props.cancelledBy;
  }

  update(input: UpdateAppointmentProps, now = new Date()): void {
    if (this.props.status === 'cancelled') {
      throw new AppointmentNotFoundError(this.id);
    }

    const startsAt = input.startsAt === undefined ? this.props.startsAt : new Date(input.startsAt);
    const endsAt = input.endsAt === undefined ? this.props.endsAt : new Date(input.endsAt);

    Appointment.assertRange(startsAt, endsAt);

    this.props.patientId = input.patientId ?? this.props.patientId;
    this.props.professionalId = input.professionalId ?? this.props.professionalId;
    this.props.startsAt = startsAt;
    this.props.endsAt = endsAt;
    this.props.reason = input.reason === undefined ? this.props.reason : normalizeText(input.reason);
    this.props.notes = input.notes === undefined ? this.props.notes : normalizeText(input.notes);
    this.props.location =
      input.location === undefined ? this.props.location : normalizeText(input.location);
    this.props.icsSequence += 1;
    this.props.updatedBy = input.actorId ?? null;
    this.props.updatedAt = now;
  }

  cancel(actorId: string | null, now = new Date()): void {
    if (this.props.status === 'cancelled') {
      return;
    }

    this.props.status = 'cancelled';
    this.props.cancelledAt = now;
    this.props.cancelledBy = actorId;
    this.props.updatedBy = actorId;
    this.props.updatedAt = now;
    this.props.icsSequence += 1;
  }

  private static assertRange(startsAt: Date, endsAt: Date): void {
    const duration = endsAt.getTime() - startsAt.getTime();

    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime())) {
      throw new InvalidAppointmentRangeError('invalid dates');
    }

    if (duration <= 0) {
      throw new InvalidAppointmentRangeError('endsAt must be after startsAt');
    }

    if (duration > MAX_DURATION_MS) {
      throw new InvalidAppointmentRangeError('appointment cannot exceed 12 hours');
    }
  }
}

function normalizeText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed === '') {
    return null;
  }

  if (trimmed.length > MAX_TEXT_LENGTH) {
    throw new InvalidAppointmentRangeError(`text must have at most ${MAX_TEXT_LENGTH} characters`);
  }

  return trimmed;
}

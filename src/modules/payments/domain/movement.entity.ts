import { Entity } from '../../../shared/domain/entity.js';
import { isPaymentMethod, type PaymentMethod } from './payment-method.js';
import { InvalidMovementError, MovementAlreadyVoidedError } from './payment.errors.js';

/**
 * `cargo` sums to the patient balance (a billed service), `abono` subtracts
 * (a payment received at the front desk).
 */
export type MovementKind = 'cargo' | 'abono';

export const MAX_CONCEPT_LENGTH = 300;
export const MAX_REFERENCE_LENGTH = 120;

export interface MovementProps {
  kind: MovementKind;
  /** Integer CLP, always > 0. */
  amount: number;
  /** Only present on `abono`; a `cargo` never carries a payment method. */
  method: PaymentMethod | null;
  /** Card voucher or bank transfer reference; reconciles the payment. */
  reference: string | null;
  concept: string;
  patientId: string;
  quoteId: string | null;
  appointmentId: string | null;
  createdBy: string | null;
  createdAt: Date;
  voidedAt: Date | null;
  voidedBy: string | null;
  voidReason: string | null;
}

export interface CreateMovementProps {
  kind: MovementKind;
  amount: number;
  method: PaymentMethod | null;
  reference: string | null;
  concept: string;
  patientId: string;
  quoteId?: string | null;
  appointmentId?: string | null;
  createdBy: string | null;
  createdAt?: Date;
}

/**
 * One entry of the patient account (libro mayor). Movements are append-only:
 * they are never edited nor deleted — mistakes are annulled with `void`,
 * which leaves an audit trail. The patient balance is *computed* from the
 * non-voided movements, never stored.
 */
export class Movement extends Entity<MovementProps> {
  private constructor(props: MovementProps, id?: string) {
    super(props, id);
  }

  static create(props: CreateMovementProps): Movement {
    if (props.kind !== 'cargo' && props.kind !== 'abono') {
      throw new InvalidMovementError('underlying kind must be "cargo" or "abono"');
    }

    if (!Number.isInteger(props.amount) || props.amount <= 0) {
      throw new InvalidMovementError('the amount must be a positive integer (CLP has no decimals)');
    }

    const concept = normalizeText(props.concept);

    if (concept === null) {
      throw new InvalidMovementError('the concept is required');
    }

    const patientId = props.patientId.trim();

    if (patientId === '') {
      throw new InvalidMovementError('the patient is required');
    }

    // A cargo is a billed service: no payment method can exist yet.
    if (props.kind === 'cargo') {
      if (props.method !== null) {
        throw new InvalidMovementError('a charge cannot carry a payment method');
      }
    } else if (!isPaymentMethod(props.method)) {
      throw new InvalidMovementError('a payment requires a valid method (efectivo/tarjeta/transferencia)');
    }

    return new Movement({
      kind: props.kind,
      amount: props.amount,
      method: props.kind === 'cargo' ? null : props.method,
      // The reference only reconciles payments; charges have nothing to reconcile.
      reference: props.kind === 'cargo' ? null : normalizeReference(props.reference),
      concept,
      patientId,
      quoteId: normalizeId(props.quoteId),
      appointmentId: normalizeId(props.appointmentId),
      createdBy: props.createdBy === null ? null : props.createdBy.trim() || null,
      createdAt: props.createdAt ?? new Date(),
      voidedAt: null,
      voidedBy: null,
      voidReason: null,
    });
  }

  /** Rebuilds a movement that already exists (e.g. loaded from a database). */
  static reconstitute(props: MovementProps, id: string): Movement {
    return new Movement(props, id);
  }

  get kind(): MovementKind {
    return this.props.kind;
  }

  get amount(): number {
    return this.props.amount;
  }

  get method(): PaymentMethod | null {
    return this.props.method;
  }

  get reference(): string | null {
    return this.props.reference;
  }

  get concept(): string {
    return this.props.concept;
  }

  get patientId(): string {
    return this.props.patientId;
  }

  get quoteId(): string | null {
    return this.props.quoteId;
  }

  get appointmentId(): string | null {
    return this.props.appointmentId;
  }

  get createdBy(): string | null {
    return this.props.createdBy;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get voidedAt(): Date | null {
    return this.props.voidedAt;
  }

  get voidedBy(): string | null {
    return this.props.voidedBy;
  }

  get voidReason(): string | null {
    return this.props.voidReason;
  }

  get isVoided(): boolean {
    return this.props.voidedAt !== null;
  }

  /** Signed amount used to compute the patient balance (+ cargo / − abono). */
  get signedAmount(): number {
    return this.props.kind === 'cargo' ? this.props.amount : -this.props.amount;
  }

  /**
   * Annuls the movement. The row stays in the ledger forever: callers only
   * replace (not delete) it afterwards. Idempotency is rejected instead of
   * allowed so double-voids surface as conflicts, not silent no-ops.
   */
  void(actorId: string | null, reason: string): void {
    if (this.isVoided) {
      throw new MovementAlreadyVoidedError(this.id);
    }

    const cleanReason = normalizeText(reason, MAX_REFERENCE_LENGTH);

    if (cleanReason === null) {
      throw new InvalidMovementError('the void reason is required');
    }

    this.props.voidedAt = new Date();
    this.props.voidedBy = actorId === null ? null : actorId.trim() || null;
    this.props.voidReason = cleanReason;
  }
}

function normalizeText(value: string, maxLength: number = MAX_CONCEPT_LENGTH): string | null {
  const normalized = value.trim();

  if (normalized === '' || normalized.length > maxLength) {
    return null;
  }

  return normalized;
}

function normalizeReference(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  return normalizeText(value, MAX_REFERENCE_LENGTH);
}

function normalizeId(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  return value.trim() || null;
}

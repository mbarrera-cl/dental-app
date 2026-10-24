/** Payment methods accepted at the front desk (caja). */
export const PAYMENT_METHODS = ['efectivo', 'tarjeta', 'transferencia'] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * `cargo` sums to the patient balance (a billed service), `abono` subtracts
 * (a payment received at the front desk).
 */
export type MovementKind = 'cargo' | 'abono';

/** One entry of the patient account (libro mayor). The ledger is append-only. */
export interface Movement {
  id: string;
  kind: MovementKind;
  /** Integer CLP, always > 0. */
  amount: number;
  /** Signs the entry the way the balance reads it: cargos positive, abonos negative. */
  signedAmount: number;
  method: PaymentMethod | null;
  /** Card voucher or bank transfer reference — reconciles the payment. */
  reference: string | null;
  concept: string;
  patientId: string;
  quoteId: string | null;
  appointmentId: string | null;
  createdBy: string | null;
  createdAt: string;
  /** Set when the movement has been voided (annulled). */
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
}

/** `GET /patients/:patientId/ledger` — history plus the computed balance. */
export interface Ledger {
  balance: number;
  movements: Movement[];
  /** Every movement of the book, across pages. */
  total: number;
  limit: number;
  offset: number;
}

/** Payload accepted by `POST /patients/:patientId/ledger/charges`. */
export interface RecordChargePayload {
  amount: number;
  concept: string;
  quoteId?: string | null;
  appointmentId?: string | null;
}

/** Payload accepted by `POST /patients/:patientId/ledger/payments`. */
export interface RecordPaymentPayload {
  amount: number;
  concept: string;
  method: PaymentMethod;
  reference?: string | null;
  quoteId?: string | null;
  appointmentId?: string | null;
}

/** One line of the cash summary (close of day). */
export interface CashSummaryEntry {
  method: PaymentMethod;
  total: number;
}

import { Injectable } from '@nestjs/common';
import { PostgresDatabase, isUuid } from '../../../../../shared/infrastructure/database/postgres-database.js';
import { LedgerRepositoryPort } from '../../../application/ports/ledger-repository.port.js';
import { Movement, type MovementKind, type MovementProps } from '../../../domain/movement.entity.js';
import {
  MovementNotFoundError,
} from '../../../domain/payment.errors.js';
import { isPaymentMethod, type PaymentMethod } from '../../../domain/payment-method.js';

interface LedgerRow {
  id: string;
  patient_id: string;
  kind: string;
  amount: number;
  method: string | null;
  reference: string | null;
  concept: string;
  quote_id: string | null;
  appointment_id: string | null;
  created_by: string | null;
  created_at: Date;
  voided_at: Date | null;
  voided_by: string | null;
  void_reason: string | null;
}

@Injectable()
export class PostgresLedgerRepository extends LedgerRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async append(movement: Movement): Promise<void> {
    await this.db.execute(
      `INSERT INTO ledger_entries
         (id, patient_id, kind, amount, method, reference, concept,
          quote_id, appointment_id, created_by, created_at, voided_at, voided_by, void_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        movement.id,
        movement.patientId,
        movement.kind,
        movement.amount,
        movement.method,
        movement.reference,
        movement.concept,
        movement.quoteId,
        movement.appointmentId,
        movement.createdBy,
        movement.createdAt,
        movement.voidedAt,
        movement.voidedBy,
        movement.voidReason,
      ],
    );
  }

  async findById(id: string): Promise<Movement | null> {
    if (!isUuid(id)) {
      return null;
    }

    const row = await this.db.queryOne<LedgerRow>('SELECT * FROM ledger_entries WHERE id = $1', [id]);

    return row === null ? null : this.toDomain(row);
  }

  async listByPatient(patientId: string, limit: number, offset: number): Promise<Movement[]> {
    const rows = await this.db.query<LedgerRow>(
      'SELECT * FROM ledger_entries WHERE patient_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3',
      [patientId, limit, offset],
    );

    return rows.map((row) => this.toDomain(row));
  }

  async countByPatient(patientId: string): Promise<number> {
    if (!isUuid(patientId)) {
      return 0;
    }

    const [row] = await this.db.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM ledger_entries WHERE patient_id = $1',
      [patientId],
    );

    return Number(row?.count ?? 0);
  }

  async listByQuoteId(quoteId: string): Promise<Movement[]> {
    if (!isUuid(quoteId)) {
      return [];
    }

    const rows = await this.db.query<LedgerRow>(
      'SELECT * FROM ledger_entries WHERE quote_id = $1 ORDER BY created_at DESC, id DESC',
      [quoteId],
    );

    return rows.map((row) => this.toDomain(row));
  }

  async replace(movement: Movement): Promise<void> {
    const result = await this.db.execute(
      `UPDATE ledger_entries SET
         voided_at = $1, voided_by = $2, void_reason = $3
       WHERE id = $4`,
      [movement.voidedAt, movement.voidedBy, movement.voidReason, movement.id],
    );

    if (result === 0) {
      throw new MovementNotFoundError(movement.id);
    }
  }

  /** Signed sum of the non-voided movements of one patient. */
  async patientBalance(patientId: string): Promise<number> {
    const row = await this.db.queryOne<{ balance: string | number }>(
      `SELECT COALESCE(SUM(CASE WHEN kind = 'cargo' THEN amount ELSE -amount END), 0) AS balance
         FROM ledger_entries
        WHERE patient_id = $1 AND voided_at IS NULL`,
      [patientId],
    );

    return Number(row?.balance ?? 0);
  }

  /** Totals of the non-voided payments by method inside an inclusive range. */
  async cashSummary(from: Date | null, to: Date | null): Promise<Array<{ method: PaymentMethod; total: number }>> {
    const rows = await this.db.query<{ method: string; total: string | number }>(
      `SELECT method, SUM(amount) AS total
         FROM ledger_entries
        WHERE kind = 'abono'
          AND voided_at IS NULL
          AND method IS NOT NULL
          AND ($1::timestamptz IS NULL OR created_at >= $1::timestamptz)
          AND ($2::timestamptz IS NULL OR created_at <= $2::timestamptz)
        GROUP BY method
        ORDER BY method ASC`,
      [from, to],
    );

    return rows.flatMap((row) =>
      isPaymentMethod(row.method) ? [{ method: row.method, total: Number(row.total) }] : [],
    );
  }

  private toDomain(row: LedgerRow): Movement {
    const props: MovementProps = {
      kind: row.kind as MovementKind,
      amount: row.amount,
      method: row.method === null ? null : (row.method as PaymentMethod),
      reference: row.reference,
      concept: row.concept,
      patientId: row.patient_id,
      quoteId: row.quote_id,
      appointmentId: row.appointment_id,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      voidedAt: row.voided_at === null ? null : new Date(row.voided_at),
      voidedBy: row.voided_by,
      voidReason: row.void_reason,
    };

    return Movement.reconstitute(props, row.id);
  }
}

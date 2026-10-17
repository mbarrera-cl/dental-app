import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SqliteDatabase } from '../../../../../shared/infrastructure/database/sqlite-database.js';
import { QuoteRepositoryPort } from '../../../application/ports/quote-repository.port.js';
import { QuoteItem, type QuoteItemStatus } from '../../../domain/quote-item.entity.js';
import { Quote, type QuoteProps, type QuoteStatus } from '../../../domain/quote.entity.js';
import { QuoteFolioTakenError } from '../../../domain/quote-folio.errors.js';
import { QuoteNotFoundError } from '../../../domain/quote.errors.js';

interface QuoteRow {
  id: string;
  folio: string;
  patient_id: string;
  patient_name: string;
  patient_rut: string;
  patient_email: string | null;
  status: string;
  valid_until: string | null;
  notes: string | null;
  subtotal: number;
  discount_total: number;
  total: number;
  version: number;
  replaces_quote_id: string | null;
  created_by: string | null;
  created_by_name: string;
  created_at: string;
  updated_by: string | null;
  updated_by_name: string;
  updated_at: string;
  sanctioned_by: string | null;
  sanctioned_by_name: string | null;
  sanctioned_at: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  deleted_by_name: string | null;
}

interface QuoteItemRow {
  id: string;
  quote_id: string;
  position: number;
  uco_code: string | null;
  description: string;
  pieza_dental: string | null;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  subtotal: number;
  discount_amount: number;
  net_amount: number;
  status: string;
  status_changed_by: string | null;
  status_changed_by_name: string | null;
  status_changed_at: string | null;
}

interface QuoteVersionRow {
  id: string;
  quote_id: string;
  version: number;
  action: string;
  snapshot_json: string;
  actor_id: string | null;
  actor_name: string;
  created_at: string;
}

/** Driven adapter backed by SQLite. Tables come from `ensureSchema`. */
@Injectable()
export class SqliteQuoteRepository extends QuoteRepositoryPort {
  private readonly db: SqliteDatabase;

  constructor(database: SqliteDatabase) {
    super();
    this.db = database;
  }

  async save(quote: Quote): Promise<void> {
    try {
      this.db.connection
        .prepare(
          `INSERT INTO quotes
             (id, folio, patient_id, patient_name, patient_rut, patient_email, status,
              valid_until, notes, subtotal, discount_total, total, version, replaces_quote_id,
              created_by, created_by_name, created_at, updated_by, updated_by_name, updated_at,
              sanctioned_by, sanctioned_by_name, sanctioned_at,
              deleted_at, deleted_by, deleted_by_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          quote.id,
          quote.folio,
          quote.patientId,
          quote.patientName,
          quote.patientRut,
          quote.patientEmail,
          quote.status,
          toIso(quote.validUntil),
          quote.notes,
          quote.subtotal,
          quote.discountTotal,
          quote.total,
          quote.version,
          quote.replacesQuoteId,
          quote.createdBy,
          quote.createdByName,
          quote.createdAt.toISOString(),
          quote.updatedBy,
          quote.updatedByName,
          quote.updatedAt.toISOString(),
          quote.sanctionedBy,
          quote.sanctionedByName,
          toIso(quote.sanctionedAt),
          toIso(quote.deletedAt),
          quote.deletedBy,
          quote.deletedByName,
        );

      this.insertItems(quote);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new QuoteFolioTakenError(quote.folio);
      }

      throw error;
    }
  }

  async update(quote: Quote): Promise<void> {
    const result = this.db.connection
      .prepare(
        `UPDATE quotes SET
           status = ?, valid_until = ?, notes = ?, subtotal = ?, discount_total = ?, total = ?,
           version = ?, updated_by = ?, updated_by_name = ?, updated_at = ?,
           sanctioned_by = ?, sanctioned_by_name = ?, sanctioned_at = ?,
           deleted_at = ?, deleted_by = ?, deleted_by_name = ?
         WHERE id = ?`,
      )
      .run(
        quote.status,
        toIso(quote.validUntil),
        quote.notes,
        quote.subtotal,
        quote.discountTotal,
        quote.total,
        quote.version,
        quote.updatedBy,
        quote.updatedByName,
        quote.updatedAt.toISOString(),
        quote.sanctionedBy,
        quote.sanctionedByName,
        toIso(quote.sanctionedAt),
        toIso(quote.deletedAt),
        quote.deletedBy,
        quote.deletedByName,
        quote.id,
      );

    if (result.changes === 0) {
      throw new QuoteNotFoundError(quote.id);
    }

    this.replaceItems(quote);
  }

  async findById(id: string): Promise<Quote | null> {
    const row = this.db.connection
      .prepare('SELECT * FROM quotes WHERE id = ?')
      .get(id) as unknown as QuoteRow | undefined;

    return row === undefined ? null : this.toDomain(row);
  }

  async findByFolio(folio: string): Promise<Quote | null> {
    const row = this.db.connection
      .prepare('SELECT * FROM quotes WHERE folio = ?')
      .get(folio) as unknown as QuoteRow | undefined;

    return row === undefined ? null : this.toDomain(row);
  }

  async findAll(): Promise<Quote[]> {
    const rows = this.db.connection
      .prepare('SELECT * FROM quotes ORDER BY created_at DESC')
      .all() as unknown as QuoteRow[];

    return rows.map((row) => this.toDomain(row));
  }

  async nextFolioNumber(year: number): Promise<number> {
    const row = this.db.connection
      .prepare('SELECT last_number FROM quote_counters WHERE year = ?')
      .get(year) as unknown as { last_number: number } | undefined;

    const next = (row === undefined ? 0 : row.last_number) + 1;

    this.db.connection
      .prepare(
        `INSERT INTO quote_counters (year, last_number) VALUES (?, ?)
         ON CONFLICT(year) DO UPDATE SET last_number = excluded.last_number`,
      )
      .run(year, next);

    return next;
  }

  async appendVersion(entry: {
    quoteId: string;
    version: number;
    action: string;
    snapshot: string;
    actorId: string | null;
    actorName: string;
    createdAt: Date;
  }): Promise<void> {
    this.db.connection
      .prepare(
        `INSERT INTO quote_versions (id, quote_id, version, action, snapshot_json, actor_id, actor_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        entry.quoteId,
        entry.version,
        entry.action,
        entry.snapshot,
        entry.actorId,
        entry.actorName,
        entry.createdAt.toISOString(),
      );
  }

  async listVersions(quoteId: string): Promise<
    Array<{ id: string; version: number; action: string; snapshot: string; actorId: string | null; actorName: string; createdAt: Date }>
  > {
    const rows = this.db.connection
      .prepare('SELECT * FROM quote_versions WHERE quote_id = ? ORDER BY version ASC')
      .all(quoteId) as unknown as QuoteVersionRow[];

    return rows.map((row) => ({
      id: row.id,
      version: row.version,
      action: row.action,
      snapshot: row.snapshot_json,
      actorId: row.actor_id,
      actorName: row.actor_name,
      createdAt: new Date(row.created_at),
    }));
  }

  private insertItems(quote: Quote): void {
    for (const item of quote.items) {
      this.db.connection
        .prepare(
          `INSERT INTO quote_items
             (id, quote_id, position, uco_code, description, pieza_dental, quantity, unit_price,
              discount_percent, subtotal, discount_amount, net_amount, status,
              status_changed_by, status_changed_by_name, status_changed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          item.id,
          quote.id,
          item.position,
          item.ucoCode,
          item.description,
          item.piezaDental,
          item.quantity,
          item.unitPrice,
          item.discountPercent,
          item.subtotal,
          item.discountAmount,
          item.netAmount,
          item.status,
          item.statusChangedBy,
          item.statusChangedByName,
          toIso(item.statusChangedAt),
        );
    }
  }

  private replaceItems(quote: Quote): void {
    this.db.connection.prepare('DELETE FROM quote_items WHERE quote_id = ?').run(quote.id);
    this.insertItems(quote);
  }

  private toDomain(row: QuoteRow): Quote {
    const itemRows = this.db.connection
      .prepare('SELECT * FROM quote_items WHERE quote_id = ? ORDER BY position ASC')
      .all(row.id) as unknown as QuoteItemRow[];

    const items = itemRows.map((item) =>
      QuoteItem.reconstitute(
        {
          position: item.position,
          ucoCode: item.uco_code,
          description: item.description,
          piezaDental: item.pieza_dental,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          discountPercent: item.discount_percent,
          subtotal: item.subtotal,
          discountAmount: item.discount_amount,
          netAmount: item.net_amount,
          status: item.status as QuoteItemStatus,
          statusChangedBy: item.status_changed_by,
          statusChangedByName: item.status_changed_by_name,
          statusChangedAt: toDate(item.status_changed_at),
        },
        item.id,
      ),
    );

    const props: QuoteProps = {
      folio: row.folio,
      patientId: row.patient_id,
      patientName: row.patient_name,
      patientRut: row.patient_rut,
      patientEmail: row.patient_email,
      status: row.status as QuoteStatus,
      validUntil: toDate(row.valid_until),
      notes: row.notes,
      items,
      version: row.version,
      replacesQuoteId: row.replaces_quote_id,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      createdAt: new Date(row.created_at),
      updatedBy: row.updated_by,
      updatedByName: row.updated_by_name,
      updatedAt: new Date(row.updated_at),
      sanctionedBy: row.sanctioned_by,
      sanctionedByName: row.sanctioned_by_name,
      sanctionedAt: toDate(row.sanctioned_at),
      deletedAt: toDate(row.deleted_at),
      deletedBy: row.deleted_by,
      deletedByName: row.deleted_by_name,
    };

    return Quote.reconstitute(props, row.id);
  }
}

function toIso(date: Date | null): string | null {
  return date === null ? null : date.toISOString();
}

function toDate(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}

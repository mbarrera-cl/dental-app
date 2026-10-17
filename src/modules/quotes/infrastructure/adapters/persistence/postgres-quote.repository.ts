import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import {
  PostgresDatabase,
  isUniqueViolation,
  isUuid,
} from '../../../../../shared/infrastructure/database/postgres-database.js';
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
  valid_until: Date | null;
  notes: string | null;
  subtotal: number;
  discount_total: number;
  total: number;
  version: number;
  replaces_quote_id: string | null;
  created_by: string | null;
  created_by_name: string;
  created_at: Date;
  updated_by: string | null;
  updated_by_name: string;
  updated_at: Date;
  sanctioned_by: string | null;
  sanctioned_by_name: string | null;
  sanctioned_at: Date | null;
  deleted_at: Date | null;
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
  status_changed_at: Date | null;
}

interface QuoteVersionRow {
  id: string;
  quote_id: string;
  version: number;
  action: string;
  snapshot_json: unknown;
  actor_id: string | null;
  actor_name: string;
  created_at: Date;
}

@Injectable()
export class PostgresQuoteRepository extends QuoteRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async save(quote: Quote): Promise<void> {
    try {
      await this.db.transaction(async (client) => {
        await client.query(
          `INSERT INTO quotes
             (id, folio, patient_id, patient_name, patient_rut, patient_email, status,
              valid_until, notes, subtotal, discount_total, total, version, replaces_quote_id,
              created_by, created_by_name, created_at, updated_by, updated_by_name, updated_at,
              sanctioned_by, sanctioned_by_name, sanctioned_at,
              deleted_at, deleted_by, deleted_by_name)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                   $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)`,
          [
            quote.id,
            quote.folio,
            quote.patientId,
            quote.patientName,
            quote.patientRut,
            quote.patientEmail,
            quote.status,
            quote.validUntil,
            quote.notes,
            quote.subtotal,
            quote.discountTotal,
            quote.total,
            quote.version,
            quote.replacesQuoteId,
            quote.createdBy,
            quote.createdByName,
            quote.createdAt,
            quote.updatedBy,
            quote.updatedByName,
            quote.updatedAt,
            quote.sanctionedBy,
            quote.sanctionedByName,
            quote.sanctionedAt,
            quote.deletedAt,
            quote.deletedBy,
            quote.deletedByName,
          ],
        );

        await this.insertItems(client, quote);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new QuoteFolioTakenError(quote.folio);
      }

      throw error;
    }
  }

  async update(quote: Quote): Promise<void> {
    await this.db.transaction(async (client) => {
      const result = await client.query(
        `UPDATE quotes SET
           status = $1, valid_until = $2, notes = $3, subtotal = $4, discount_total = $5, total = $6,
           version = $7, updated_by = $8, updated_by_name = $9, updated_at = $10,
           sanctioned_by = $11, sanctioned_by_name = $12, sanctioned_at = $13,
           deleted_at = $14, deleted_by = $15, deleted_by_name = $16
         WHERE id = $17`,
        [
          quote.status,
          quote.validUntil,
          quote.notes,
          quote.subtotal,
          quote.discountTotal,
          quote.total,
          quote.version,
          quote.updatedBy,
          quote.updatedByName,
          quote.updatedAt,
          quote.sanctionedBy,
          quote.sanctionedByName,
          quote.sanctionedAt,
          quote.deletedAt,
          quote.deletedBy,
          quote.deletedByName,
          quote.id,
        ],
      );

      if ((result.rowCount ?? 0) === 0) {
        throw new QuoteNotFoundError(quote.id);
      }

      await client.query('DELETE FROM quote_items WHERE quote_id = $1', [quote.id]);
      await this.insertItems(client, quote);
    });
  }

  async findById(id: string): Promise<Quote | null> {
    if (!isUuid(id)) {
      return null;
    }

    const row = await this.db.queryOne<QuoteRow>('SELECT * FROM quotes WHERE id = $1', [id]);
    return row === null ? null : this.toDomain(row);
  }

  async findByFolio(folio: string): Promise<Quote | null> {
    const row = await this.db.queryOne<QuoteRow>('SELECT * FROM quotes WHERE folio = $1', [folio]);
    return row === null ? null : this.toDomain(row);
  }

  async findAll(): Promise<Quote[]> {
    const rows = await this.db.query<QuoteRow>('SELECT * FROM quotes ORDER BY created_at DESC, id ASC');
    const quotes: Quote[] = [];

    for (const row of rows) {
      quotes.push(await this.toDomain(row));
    }

    return quotes;
  }

  async nextFolioNumber(year: number): Promise<number> {
    const row = await this.db.queryOne<{ last_number: number }>(
      `INSERT INTO quote_counters (year, last_number)
       VALUES ($1, 1)
       ON CONFLICT (year) DO UPDATE
         SET last_number = quote_counters.last_number + 1
       RETURNING last_number`,
      [year],
    );

    return Number(row?.last_number ?? 1);
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
    await this.db.execute(
      `INSERT INTO quote_versions
         (id, quote_id, version, action, snapshot_json, actor_id, actor_name, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
      [
        randomUUID(),
        entry.quoteId,
        entry.version,
        entry.action,
        entry.snapshot,
        entry.actorId,
        entry.actorName,
        entry.createdAt,
      ],
    );
  }

  async listVersions(quoteId: string): Promise<
    Array<{
      id: string;
      version: number;
      action: string;
      snapshot: string;
      actorId: string | null;
      actorName: string;
      createdAt: Date;
    }>
  > {
    const rows = await this.db.query<QuoteVersionRow>(
      'SELECT * FROM quote_versions WHERE quote_id = $1 ORDER BY version ASC',
      [quoteId],
    );

    return rows.map((row) => ({
      id: row.id,
      version: row.version,
      action: row.action,
      snapshot: typeof row.snapshot_json === 'string'
        ? row.snapshot_json
        : JSON.stringify(row.snapshot_json),
      actorId: row.actor_id,
      actorName: row.actor_name,
      createdAt: new Date(row.created_at),
    }));
  }

  private async insertItems(client: PoolClient, quote: Quote): Promise<void> {
    for (const item of quote.items) {
      await client.query(
        `INSERT INTO quote_items
           (id, quote_id, position, uco_code, description, pieza_dental, quantity, unit_price,
            discount_percent, subtotal, discount_amount, net_amount, status,
            status_changed_by, status_changed_by_name, status_changed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
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
          item.statusChangedAt,
        ],
      );
    }
  }

  private async toDomain(row: QuoteRow): Promise<Quote> {
    const itemRows = await this.db.query<QuoteItemRow>(
      'SELECT * FROM quote_items WHERE quote_id = $1 ORDER BY position ASC, id ASC',
      [row.id],
    );

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
          statusChangedAt:
            item.status_changed_at === null ? null : new Date(item.status_changed_at),
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
      validUntil: row.valid_until === null ? null : new Date(row.valid_until),
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
      sanctionedAt: row.sanctioned_at === null ? null : new Date(row.sanctioned_at),
      deletedAt: row.deleted_at === null ? null : new Date(row.deleted_at),
      deletedBy: row.deleted_by,
      deletedByName: row.deleted_by_name,
    };

    return Quote.reconstitute(props, row.id);
  }
}

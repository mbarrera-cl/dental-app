import { Injectable } from '@nestjs/common';
import { PostgresDatabase } from '../../../../../shared/infrastructure/database/postgres-database.js';
import {
  AgendaEmailOutboxRepositoryPort,
  type AgendaEmailEvent,
  type AgendaEmailOutboxRecord,
  type AgendaEmailStatus,
  type AgendaRecipientKind,
  type NewAgendaEmailOutboxRecord,
} from '../../../application/ports/agenda-email-outbox.repository.port.js';

interface OutboxRow {
  id: string;
  appointment_id: string;
  event_type: string;
  recipient_kind: string;
  recipient_email: string;
  subject: string;
  html: string;
  text: string;
  ics: string;
  status: string;
  attempts: number;
  next_attempt_at: Date;
  last_error: string | null;
  created_at: Date;
  sent_at: Date | null;
}

@Injectable()
export class PostgresAgendaEmailOutboxRepository extends AgendaEmailOutboxRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async saveMany(records: readonly NewAgendaEmailOutboxRecord[]): Promise<void> {
    if (records.length === 0) {
      return;
    }

    await this.db.transaction(async (client) => {
      for (const record of records) {
        await client.query(
          `INSERT INTO agenda_email_outbox (
             id, appointment_id, event_type, recipient_kind, recipient_email,
             subject, html, text, ics, status, attempts, next_attempt_at,
             last_error, created_at, sent_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            record.id,
            record.appointmentId,
            record.eventType,
            record.recipientKind,
            record.recipientEmail,
            record.subject,
            record.html,
            record.text,
            record.ics,
            record.status,
            record.attempts ?? 0,
            record.nextAttemptAt,
            record.lastError ?? null,
            record.createdAt,
            record.sentAt ?? null,
          ],
        );
      }
    });
  }

  async claimPending(limit: number): Promise<AgendaEmailOutboxRecord[]> {
    const rows = await this.db.query<OutboxRow>(
      `UPDATE agenda_email_outbox
       SET status = 'sending'
       WHERE id IN (
         SELECT id FROM agenda_email_outbox
         WHERE status = 'pending' AND next_attempt_at <= NOW()
         ORDER BY next_attempt_at ASC, created_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *`,
      [limit],
    );

    return rows.map(toRecord);
  }

  async markSent(id: string, sentAt: Date): Promise<void> {
    await this.db.execute(
      `UPDATE agenda_email_outbox
       SET status = 'sent', sent_at = $1, last_error = NULL
       WHERE id = $2`,
      [sentAt, id],
    );
  }

  async markRetry(id: string, nextAttemptAt: Date, error: string): Promise<void> {
    await this.db.execute(
      `UPDATE agenda_email_outbox
       SET status = 'pending', attempts = attempts + 1,
           next_attempt_at = $1, last_error = $2
       WHERE id = $3`,
      [nextAttemptAt, error, id],
    );
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.db.execute(
      `UPDATE agenda_email_outbox
       SET status = 'failed', attempts = attempts + 1, last_error = $1
       WHERE id = $2`,
      [error, id],
    );
  }

  async markSkipped(id: string, reason: string): Promise<void> {
    await this.db.execute(
      `UPDATE agenda_email_outbox
       SET status = 'skipped', last_error = $1
       WHERE id = $2`,
      [reason, id],
    );
  }
}

function toRecord(row: OutboxRow): AgendaEmailOutboxRecord {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    eventType: row.event_type as AgendaEmailEvent,
    recipientKind: row.recipient_kind as AgendaRecipientKind,
    recipientEmail: row.recipient_email,
    subject: row.subject,
    html: row.html,
    text: row.text,
    ics: row.ics,
    status: row.status as AgendaEmailStatus,
    attempts: Number(row.attempts),
    nextAttemptAt: row.next_attempt_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    sentAt: row.sent_at,
  };
}

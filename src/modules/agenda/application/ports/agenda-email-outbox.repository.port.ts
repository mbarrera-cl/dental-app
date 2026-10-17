export type AgendaEmailEvent = 'created' | 'updated' | 'cancelled';
export type AgendaRecipientKind = 'patient' | 'professional';
export type AgendaEmailStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'skipped';

export interface AgendaEmailOutboxRecord {
  id: string;
  appointmentId: string;
  eventType: AgendaEmailEvent;
  recipientKind: AgendaRecipientKind;
  recipientEmail: string;
  subject: string;
  html: string;
  text: string;
  ics: string;
  status: AgendaEmailStatus;
  attempts: number;
  nextAttemptAt: Date;
  lastError: string | null;
  createdAt: Date;
  sentAt: Date | null;
}

export interface NewAgendaEmailOutboxRecord {
  id: string;
  appointmentId: string;
  eventType: AgendaEmailEvent;
  recipientKind: AgendaRecipientKind;
  recipientEmail: string;
  subject: string;
  html: string;
  text: string;
  ics: string;
  status: AgendaEmailStatus;
  attempts?: number;
  nextAttemptAt: Date;
  lastError?: string | null;
  createdAt: Date;
  sentAt?: Date | null;
}

export abstract class AgendaEmailOutboxRepositoryPort {
  abstract saveMany(records: readonly NewAgendaEmailOutboxRecord[]): Promise<void>;

  abstract claimPending(limit: number): Promise<AgendaEmailOutboxRecord[]>;

  abstract markSent(id: string, sentAt: Date): Promise<void>;

  abstract markRetry(id: string, nextAttemptAt: Date, error: string): Promise<void>;

  abstract markFailed(id: string, error: string): Promise<void>;

  abstract markSkipped(id: string, reason: string): Promise<void>;
}

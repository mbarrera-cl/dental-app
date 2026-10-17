import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { AgendaEmailOutboxRepositoryPort } from '../ports/agenda-email-outbox.repository.port.js';
import { EmailSenderPort } from '../ports/email-sender.port.js';

const POLL_INTERVAL_MS = 15_000;
const BATCH_SIZE = 10;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000];

@Injectable()
export class EmailOutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailOutboxWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly outbox: AgendaEmailOutboxRepositoryPort,
    private readonly sender: EmailSenderPort,
  ) {}

  onModuleInit(): void {
    if (process.env.AGENDA_EMAIL_WORKER === 'false') {
      return;
    }

    this.timer = setInterval(() => {
      void this.processOnce();
    }, POLL_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async processOnce(): Promise<void> {
    if (this.running || !this.sender.isConfigured()) {
      return;
    }

    this.running = true;

    try {
      const records = await this.outbox.claimPending(BATCH_SIZE);

      for (const record of records) {
        try {
          await this.sender.send({
            to: record.recipientEmail,
            subject: record.subject,
            html: record.html,
            text: record.text,
            attachments: [
              {
                filename: 'invitacion.ics',
                content: Buffer.from(record.ics).toString('base64'),
                contentType:
                  record.eventType === 'cancelled'
                    ? 'text/calendar; method=CANCEL'
                    : 'text/calendar; method=REQUEST',
              },
            ],
          });
          await this.outbox.markSent(record.id, new Date());
        } catch (error) {
          const message = error instanceof Error ? error.message : 'unknown email error';
          const delay = RETRY_DELAYS_MS[record.attempts];

          if (delay === undefined) {
            await this.outbox.markFailed(record.id, message);
            this.logger.error(`Email ${record.id} failed permanently: ${message}`);
          } else {
            await this.outbox.markRetry(record.id, new Date(Date.now() + delay), message);
            this.logger.warn(`Email ${record.id} will be retried: ${message}`);
          }
        }
      }
    } finally {
      this.running = false;
    }
  }
}

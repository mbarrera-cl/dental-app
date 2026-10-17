import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../../../settings/application/settings.service.js';
import type { AppointmentView } from '../../domain/appointment.models.js';
import type {
  AgendaEmailEvent,
  AgendaRecipientKind,
  NewAgendaEmailOutboxRecord,
} from '../ports/agenda-email-outbox.repository.port.js';
import { AgendaEmailOutboxRepositoryPort } from '../ports/agenda-email-outbox.repository.port.js';
import { EmailSenderPort } from '../ports/email-sender.port.js';
import { AgendaTemplateService } from './agenda-template.service.js';
import { AppointmentIcsService } from './appointment-ics.service.js';

@Injectable()
export class AgendaEmailService {
  private readonly logger = new Logger(AgendaEmailService.name);

  constructor(
    private readonly settings: SettingsService,
    private readonly templates: AgendaTemplateService,
    private readonly ics: AppointmentIcsService,
    private readonly outbox: AgendaEmailOutboxRepositoryPort,
    private readonly sender: EmailSenderPort,
  ) {}

  async queue(view: AppointmentView, event: AgendaEmailEvent): Promise<void> {
    try {
      await this.queueUnsafe(view, event);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown email queue error';
      this.logger.error(`Could not queue ${event} email for appointment ${view.appointment.id}: ${message}`);
    }
  }

  private async queueUnsafe(view: AppointmentView, event: AgendaEmailEvent): Promise<void> {
    const [notifyPatient, notifyProfessional] = await Promise.all([
      this.settings.getBoolean('agenda.notifyPatient'),
      this.settings.getBoolean('agenda.notifyProfessional'),
    ]);
    const recipients: Array<{ kind: AgendaRecipientKind; email: string | null }> = [];

    if (notifyPatient) {
      recipients.push({ kind: 'patient', email: view.patient.email });
    }

    if (notifyProfessional) {
      recipients.push({ kind: 'professional', email: view.professional.email });
    }

    const records: NewAgendaEmailOutboxRecord[] = [];
    const now = new Date();

    for (const recipient of recipients) {
      if (recipient.email === null || recipient.email.trim() === '') {
        continue;
      }

      const [rendered, ics] = await Promise.all([
        this.templates.render(view, event, recipient.kind),
        this.ics.generate(view, event, recipient.kind),
      ]);

      if (ics === '') {
        continue;
      }

      records.push({
        id: randomUUID(),
        appointmentId: view.appointment.id,
        eventType: event,
        recipientKind: recipient.kind,
        recipientEmail: recipient.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        ics,
        status: this.sender.isConfigured() ? 'pending' : 'skipped',
        nextAttemptAt: now,
        lastError: this.sender.isConfigured() ? null : 'email_not_configured',
        createdAt: now,
      });
    }

    await this.outbox.saveMany(records);
  }
}

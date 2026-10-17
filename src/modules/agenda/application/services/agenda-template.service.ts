import { Injectable } from '@nestjs/common';
import { convert } from 'html-to-text';
import sanitizeHtml from 'sanitize-html';
import { SettingsService } from '../../../settings/application/settings.service.js';
import type { AppointmentView } from '../../domain/appointment.models.js';
import type { AgendaEmailEvent, AgendaRecipientKind } from '../ports/agenda-email-outbox.repository.port.js';

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a',
];

@Injectable()
export class AgendaTemplateService {
  constructor(private readonly settings: SettingsService) {}

  async render(
    view: AppointmentView,
    event: AgendaEmailEvent,
    recipientKind: AgendaRecipientKind,
  ): Promise<{ subject: string; html: string; text: string }> {
    const [subjectTemplate, bodyTemplate, timeZone, clinicName, clinicEmail, address] =
      await Promise.all([
        this.settings.getValue('agenda.confirmationSubject'),
        this.settings.getValue('agenda.confirmationHtml'),
        this.settings.getValue('clinic.timeZone'),
        this.settings.getValue('clinic.name'),
        this.settings.getValue('clinic.contact.email'),
        this.clinicAddress(),
      ]);

    const recipientName =
      recipientKind === 'patient' ? view.patient.nombreCompleto : view.professional.name;
    const values = this.values(view, event, timeZone as string, clinicName as string, clinicEmail as string, address, recipientName);

    const subject = this.interpolate(String(subjectTemplate), values, false);
    const sanitized = sanitizeHtml(String(bodyTemplate), {
      allowedTags: ALLOWED_TAGS,
      allowedAttributes: { a: ['href', 'title'] },
      allowedSchemes: ['http', 'https', 'mailto'],
      disallowedTagsMode: 'discard',
    });
    const html = this.interpolate(sanitized, values, true);
    const text = convert(html, { wordwrap: 100, selectors: [{ selector: 'a', options: { ignoreHref: true } }] });

    return { subject: subject.trim(), html, text };
  }

  private values(
    view: AppointmentView,
    event: AgendaEmailEvent,
    timeZone: string,
    clinicName: string,
    clinicEmail: string,
    clinicAddress: string,
    recipientName: string,
  ): Record<string, string> {
    const start = view.appointment.startsAt;
    const end = view.appointment.endsAt;
    const duration = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
    const date = new Intl.DateTimeFormat('es-CL', {
      dateStyle: 'full',
      timeZone,
    }).format(start);
    const time = new Intl.DateTimeFormat('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone,
    }).format(start);
    const state = event === 'created' ? 'confirmada' : event === 'updated' ? 'actualizada' : 'cancelada';

    return {
      destinatario: recipientName,
      paciente: view.patient.nombreCompleto,
      profesional: view.professional.name,
      fecha: date,
      hora: time,
      duracion: `${duration} minutos`,
      motivo: view.appointment.reason ?? '—',
      estado: state,
      clinica: clinicName || 'Hexa',
      correo_clinica: clinicEmail || '',
      direccion: view.appointment.location ?? (clinicAddress || '—'),
      zona_horaria: timeZone,
    };
  }

  private interpolate(
    template: string,
    values: Readonly<Record<string, string>>,
    escapeValues: boolean,
  ): string {
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
      const value = values[key] ?? '';
      return escapeValues ? escapeHtml(value) : value.replace(/[\r\n]+/g, ' ');
    });
  }

  private async clinicAddress(): Promise<string> {
    const [calle, numero, comuna, region] = await Promise.all([
      this.settings.getValue('clinic.address.calle'),
      this.settings.getValue('clinic.address.numero'),
      this.settings.getValue('clinic.address.comuna'),
      this.settings.getValue('clinic.address.region'),
    ]);

    return [calle, numero, comuna, region]
      .map((value) => String(value ?? '').trim())
      .filter((value) => value !== '')
      .join(', ');
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

import { Injectable } from '@nestjs/common';
import ical, { ICalCalendarMethod, ICalEventStatus } from 'ical-generator';
import { DateTime } from 'luxon';
import { tzlib_get_ical_block } from 'timezones-ical-library';
import { SettingsService } from '../../../settings/application/settings.service.js';
import type { AppointmentView } from '../../domain/appointment.models.js';
import type { AgendaEmailEvent, AgendaRecipientKind } from '../ports/agenda-email-outbox.repository.port.js';

@Injectable()
export class AppointmentIcsService {
  constructor(private readonly settings: SettingsService) {}

  async generate(
    view: AppointmentView,
    eventType: AgendaEmailEvent,
    recipientKind: AgendaRecipientKind,
  ): Promise<string> {
    const [timeZone, clinicName, clinicEmail, address] = await Promise.all([
      this.settings.getValue('clinic.timeZone'),
      this.settings.getValue('clinic.name'),
      this.settings.getValue('clinic.contact.email'),
      this.settings.getValue('clinic.address.calle'),
    ]);
    const recipient =
      recipientKind === 'patient'
        ? { email: view.patient.email, name: view.patient.nombreCompleto }
        : { email: view.professional.email, name: view.professional.name };

    if (recipient.email === null || recipient.email === '') {
      return '';
    }

    const start = DateTime.fromJSDate(view.appointment.startsAt, { zone: timeZone as string });
    const end = DateTime.fromJSDate(view.appointment.endsAt, { zone: timeZone as string });
    const organizerEmail = emailAddress(String(clinicEmail ?? '').trim() || process.env.MAIL_FROM || 'no-reply@hexa.local');
    const calendar = ical({
      name: String(clinicName ?? 'Hexa'),
      timezone: {
        name: timeZone as string,
        generator: (zone: string) => tzlib_get_ical_block(zone)[0],
      },
    });

    calendar.method(
      eventType === 'cancelled' ? ICalCalendarMethod.CANCEL : ICalCalendarMethod.REQUEST,
    );
    const event = calendar.createEvent({
      id: `appointment-${view.appointment.id}@hexa`,
      start,
      end,
      sequence: view.appointment.icsSequence,
      stamp: new Date(),
      summary: `Hora con ${view.professional.name}`,
      description: [
        `Paciente: ${view.patient.nombreCompleto}`,
        `Profesional: ${view.professional.name}`,
        `Motivo: ${view.appointment.reason ?? '—'}`,
        `Estado: ${eventType}`,
      ].join('\n'),
      location: view.appointment.location ?? String(address ?? ''),
      organizer: { name: String(clinicName ?? 'Hexa'), email: organizerEmail },
      status: eventType === 'cancelled' ? ICalEventStatus.CANCELLED : ICalEventStatus.CONFIRMED,
    });
    event.createAttendee({ email: recipient.email, name: recipient.name, rsvp: true });

    return calendar.toString();
  }
}

function emailAddress(value: string): string {
  const match = /<([^>]+)>/.exec(value);
  return (match?.[1] ?? value).trim();
}

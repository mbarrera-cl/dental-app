import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DateTime } from 'luxon';
import { TranslocoService } from '@jsverse/transloco';
import {
  FullCalendarModule,
  type CalendarOptions,
  type DateClickInfo,
  type DatesSetInfo,
  type EventClickInfo,
  type EventInput,
} from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/angular/daygrid';
import timeGridPlugin from '@fullcalendar/angular/timegrid';
import interactionPlugin from '@fullcalendar/angular/interaction';
import classicTheme from '@fullcalendar/angular/themes/classic';
import { HlmButton } from '@ui/button';
import { HlmInput } from '@ui/input';
import {
  AgendaApi,
  mapApiError,
  type AgendaConfig,
  type AgendaPatient,
  type AgendaProfessional,
  type AgendaReason,
  type Appointment,
  type AppointmentConflict,
} from 'data-access';

const ES_LOCALE = {
  code: 'es',
  week: { dow: 1, doy: 4 },
  prevText: 'Ant',
  nextText: 'Sig',
  todayText: 'Hoy',
  yearText: 'Año',
  monthText: 'Mes',
  weekTextLong: 'Semana',
  weekTextShort: 'Sm',
  dayText: 'Día',
  listText: 'Agenda',
  allDayText: 'Todo el día',
  timedText: 'Horas',
  moreLinkText: 'más',
  noEventsText: 'No hay eventos para mostrar',
  closeHint: 'Cerrar',
  eventsHint: 'Eventos',
};

interface AgendaForm {
  id: string | null;
  patientId: string;
  professionalId: string;
  date: string;
  time: string;
  durationMinutes: number;
  reason: string;
  notes: string;
  location: string;
}

@Component({
  selector: 'app-agenda-page',
  imports: [FullCalendarModule, HlmButton, HlmInput],
  templateUrl: './agenda-page.html',
  styleUrl: './agenda-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaPage {
  private readonly api = inject(AgendaApi);
  private readonly route = inject(ActivatedRoute);
  private readonly transloco = inject(TranslocoService);

  protected readonly config = signal<AgendaConfig | null>(null);
  protected readonly professionals = signal<AgendaProfessional[]>([]);
  protected readonly reasons = signal<AgendaReason[]>([]);
  protected readonly patients = signal<AgendaPatient[]>([]);
  protected readonly appointments = signal<Appointment[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly filterProfessionalId = signal('');
  protected readonly patientQuery = signal('');
  protected readonly formOpen = signal(false);
  protected readonly conflicts = signal<AppointmentConflict[]>([]);
  protected readonly form = signal<AgendaForm>(this.emptyForm());
  private range = { from: new Date(), to: new Date() };
  private patientSearchTimer: ReturnType<typeof setTimeout> | null = null;



  protected readonly calendarOptions = computed<CalendarOptions>(() => ({
    plugins: [classicTheme, dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: 'timeGridWeek',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay',
    },
    locale: ES_LOCALE,
    timeZone: this.config()?.timeZone ?? 'America/Santiago',
    height: '100%',
    allDaySlot: false,
    slotMinTime: '08:00:00',
    slotMaxTime: '20:00:00',
    nowIndicator: true,
    selectable: true,
    editable: false,
    eventClick: (info) => this.onEventClick(info),
    dateClick: (info) => this.onDateClick(info),
    datesSet: (info) => this.onDatesSet(info),
    events: this.toEvents(this.appointments()),
  }));

  constructor() {
    void this.loadInitial();
  }

  protected patientName(patient: AgendaPatient): string {
    return patient.nombreCompleto;
  }

  protected statusLabel(appointment: Appointment): string {
    switch (appointment.status) {
      case 'scheduled':
        return 'Agendada';
      case 'cancelled':
        return 'Cancelada';
      case 'completed':
        return 'Completada';
      case 'no_show':
        return 'No asistió';
    }
  }

  protected openNew(): void {
    const now = DateTime.now().setZone(this.timeZone());
    this.form.set({
      ...this.emptyForm(),
      date: now.toFormat('yyyy-MM-dd'),
      time: '09:00',
      durationMinutes: this.config()?.defaultDurationMinutes ?? 30,
    });
    this.conflicts.set([]);
    this.formOpen.set(true);
    this.error.set(null);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.conflicts.set([]);
    this.error.set(null);
  }

  protected setField<K extends keyof AgendaForm>(key: K, value: AgendaForm[K]): void {
    this.form.update((form) => ({ ...form, [key]: value }));
    this.conflicts.set([]);
  }

  protected onTextInput(key: 'reason' | 'notes' | 'location', event: Event): void {
    this.setField(key, (event.target as HTMLInputElement | HTMLTextAreaElement).value);
  }

  protected onPatientQuery(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.patientQuery.set(query);

    if (this.patientSearchTimer !== null) {
      clearTimeout(this.patientSearchTimer);
    }

    this.patientSearchTimer = setTimeout(() => {
      void firstValueFrom(this.api.patients(query))
        .then((patients) => this.patients.set(patients))
        .catch((error: unknown) => this.error.set(this.transloco.translate(mapApiError(error))));
    }, 250);
  }

  protected onFilterProfessional(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filterProfessionalId.set(value);
    void this.loadRange(this.range.from, this.range.to);
  }

  protected async save(): Promise<void> {
    const form = this.form();
    this.error.set(null);
    this.message.set(null);

    if (form.patientId === '' || form.professionalId === '' || form.date === '' || form.time === '') {
      this.error.set('Selecciona paciente, profesional, fecha y hora.');
      return;
    }

    const startsAt = this.localToUtc(form.date, form.time);
    const endsAt = DateTime.fromISO(startsAt)
      .plus({ minutes: form.durationMinutes })
      .toUTC()
      .toISO();

    if (endsAt === null) {
      this.error.set('La duración no es válida.');
      return;
    }

    this.saving.set(true);

    try {
      if (this.conflicts().length === 0) {
        const overlaps = await firstValueFrom(
          this.api.conflicts(form.professionalId, startsAt, endsAt, form.id ?? undefined),
        );

        if (overlaps.length > 0) {
          this.conflicts.set(overlaps);
          this.error.set('Ese profesional ya tiene una hora en ese rango. Puedes guardar igualmente.');
          this.saving.set(false);
          return;
        }
      }

      if (form.id === null) {
        await firstValueFrom(
          this.api.create({
            patientId: form.patientId,
            professionalId: form.professionalId,
            startsAt,
            endsAt,
            reason: form.reason || null,
            notes: form.notes || null,
            location: form.location || null,
          }),
        );
        this.message.set('Hora agendada. Se generarán las confirmaciones configuradas.');
      } else {
        await firstValueFrom(
          this.api.update(form.id, {
            patientId: form.patientId,
            professionalId: form.professionalId,
            startsAt,
            endsAt,
            reason: form.reason || null,
            notes: form.notes || null,
            location: form.location || null,
          }),
        );
        this.message.set('Hora actualizada. Se generarán las confirmaciones configuradas.');
      }

      this.formOpen.set(false);
      this.conflicts.set([]);
      await this.loadRange(this.range.from, this.range.to);
    } catch (error) {
      this.error.set(this.transloco.translate(mapApiError(error)));
    } finally {
      this.saving.set(false);
    }
  }

  protected async cancelSelected(): Promise<void> {
    const id = this.form().id;

    if (id === null || !window.confirm('¿Cancelar esta hora? Se enviará un aviso si está configurado.')) {
      return;
    }

    this.saving.set(true);

    try {
      await firstValueFrom(this.api.cancel(id));
      this.message.set('Hora cancelada.');
      this.formOpen.set(false);
      await this.loadRange(this.range.from, this.range.to);
    } catch (error) {
      this.error.set(this.transloco.translate(mapApiError(error)));
    } finally {
      this.saving.set(false);
    }
  }

  protected formatConflict(conflict: AppointmentConflict): string {
    const start = DateTime.fromISO(conflict.startsAt, { zone: this.timeZone() });
    return `${start.toFormat('dd/LL HH:mm')} · ${conflict.patientName}`;
  }

  protected timeZone(): string {
    return this.config()?.timeZone ?? 'America/Santiago';
  }

  private async loadInitial(): Promise<void> {
    this.loading.set(true);

    try {
      const [config, professionals, reasons, patients] = await Promise.all([
        firstValueFrom(this.api.config()),
        firstValueFrom(this.api.professionals()),
        firstValueFrom(this.api.reasons()),
        firstValueFrom(this.api.patients('')),
      ]);
      this.config.set(config);
      this.professionals.set(professionals);
      this.reasons.set(reasons);
      this.patients.set(patients);
      await this.loadRange(this.range.from, this.range.to);

      const preselectedPatient = this.route.snapshot.queryParamMap.get('patientId');

      if (preselectedPatient !== null) {
        let selected = patients.find((patient) => patient.id === preselectedPatient);

        if (selected === undefined) {
          try {
            selected = await firstValueFrom(this.api.patient(preselectedPatient));
            this.patients.update((list) => [selected!, ...list]);
          } catch {
            selected = undefined;
          }
        }

        if (selected !== undefined) {
          const start = DateTime.now().setZone(config.timeZone).plus({ hours: 1 }).set({ minute: 0, second: 0, millisecond: 0 });
          this.patientQuery.set(this.patientName(selected));
          this.form.set({
            ...this.emptyForm(),
            patientId: preselectedPatient,
            professionalId: this.professionals()[0]?.id ?? '',
            date: start.toFormat('yyyy-MM-dd'),
            time: start.toFormat('HH:mm'),
            durationMinutes: config.defaultDurationMinutes,
          });
          this.formOpen.set(true);
        }
      }
    } catch (error) {
      this.error.set(this.transloco.translate(mapApiError(error)));
    } finally {
      this.loading.set(false);
    }
  }

  private async loadRange(from: Date, to: Date): Promise<void> {
    this.range = { from, to };

    try {
      const appointments = await firstValueFrom(
        this.api.list(
          from.toISOString(),
          to.toISOString(),
          this.filterProfessionalId() || undefined,
        ),
      );
      this.appointments.set(appointments);
    } catch (error) {
      this.error.set(this.transloco.translate(mapApiError(error)));
    }
  }

  private onDatesSet(info: DatesSetInfo): void {
    void this.loadRange(info.start, info.end);
  }

  private onDateClick(info: DateClickInfo): void {
    const local = DateTime.fromJSDate(info.date, { zone: this.timeZone() });

    this.form.set({
      ...this.emptyForm(),
      date: local.toFormat('yyyy-MM-dd'),
      time: info.allDay ? '09:00' : local.toFormat('HH:mm'),
      durationMinutes: this.config()?.defaultDurationMinutes ?? 30,
    });
    this.conflicts.set([]);
    this.formOpen.set(true);
  }

  private onEventClick(info: EventClickInfo): void {
    const appointment = this.appointments().find((item) => item.id === info.event.id);

    if (appointment === undefined) {
      return;
    }

    const start = DateTime.fromISO(appointment.startsAt, { zone: this.timeZone() });
    const end = DateTime.fromISO(appointment.endsAt, { zone: this.timeZone() });

    this.form.set({
      id: appointment.id,
      patientId: appointment.patient.id,
      professionalId: appointment.professional.id,
      date: start.toFormat('yyyy-MM-dd'),
      time: start.toFormat('HH:mm'),
      durationMinutes: Math.max(5, Math.round(end.diff(start, 'minutes').minutes)),
      reason: appointment.reason ?? '',
      notes: appointment.notes ?? '',
      location: appointment.location ?? '',
    });
    this.patientQuery.set(appointment.patient.nombreCompleto);
    this.conflicts.set([]);
    this.formOpen.set(true);
    this.error.set(null);
  }

  private toEvents(appointments: readonly Appointment[]): EventInput[] {
    return appointments.map((appointment) => ({
      id: appointment.id,
      title: `${appointment.patient.nombreCompleto} · ${appointment.reason ?? 'Hora'}`,
      start: appointment.startsAt,
      end: appointment.endsAt,
      color:
        appointment.status === 'cancelled'
          ? '#ef4444'
          : appointment.status === 'completed'
            ? '#64748b'
            : '#0284c7',
      textColor: '#ffffff',
    }));
  }

  private localToUtc(date: string, time: string): string {
    const value = DateTime.fromISO(`${date}T${time}`, { zone: this.timeZone() });

    if (!value.isValid) {
      throw new Error('La fecha u hora no es válida.');
    }

    return value.toUTC().toISO()!;
  }

  private emptyForm(): AgendaForm {
    return {
      id: null,
      patientId: '',
      professionalId: '',
      date: '',
      time: '',
      durationMinutes: this.config()?.defaultDurationMinutes ?? 30,
      reason: '',
      notes: '',
      location: '',
    };
  }
}

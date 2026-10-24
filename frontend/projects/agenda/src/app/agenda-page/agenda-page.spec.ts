import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideAppTransloco, provideSpartanHlm } from 'ui';
import type { AgendaPatient, Patient } from 'data-access';
import { AgendaPage } from './agenda-page';

const BASE = 'http://localhost:3000';

const CONFIG = {
  timeZone: 'America/Santiago',
  defaultDurationMinutes: 30,
  notifyPatient: true,
  notifyProfessional: true,
};

const PATIENT: Patient = {
  id: 'patient-1',
  rut: '12345678-5',
  nombres: 'Camila',
  apellidoPaterno: 'Rojas',
  apellidoMaterno: 'Pérez',
  fechaNacimiento: '1990-05-17',
  sexo: 'femenino',
  email: 'camila@example.com',
  telefono: null,
  direccion: null,
  prevision: null,
  contactoEmergencia: null,
  notas: null,
  numeroHistoria: 'HC-000001',
  createdAt: '2026-10-01T08:00:00.000Z',
};

const AGENDA_PATIENT: AgendaPatient = {
  id: PATIENT.id,
  nombreCompleto: 'Camila Rojas Pérez',
  rut: PATIENT.rut,
  email: PATIENT.email,
};

interface PageHandle {
  config(): typeof CONFIG;
  formOpen(): boolean;
  form(): { durationMinutes: number; patientId: string; time: string; date: string };
  calendarOptions(): {
    timeZone?: string;
    select?: (info: unknown) => void;
  };
  patientQuery(): string;
  selectedPatient(): AgendaPatient | null;
  openNew(): void;
  onPatientQuery(event: Event): void;
  selectPatient(patient: AgendaPatient): void;
}

describe('AgendaPage', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgendaPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAppTransloco(),
        provideSpartanHlm(),
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  const loadInitial = async (fixture: ComponentFixture<AgendaPage>): Promise<void> => {
    http.expectOne(`${BASE}/agenda/config`).flush(CONFIG);
    http
      .expectOne(`${BASE}/agenda/professionals`)
      .flush([{ id: 'pro-1', name: 'Dra. Ana', email: 'ana@example.com' }]);
    http
      .expectOne(`${BASE}/agenda/reasons`)
      .flush([{ id: 'reason-1', name: 'Control', createdAt: '', updatedAt: '' }]);
    http
      .expectOne(
        (request) =>
          request.url === `${BASE}/agenda/patients` && request.params.get('query') === '',
      )
      .flush([AGENDA_PATIENT]);
    http.match(`${BASE}/agenda/appointments`).forEach((request) => request.flush([]));

    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('loads config, professionals and patients, then opens a blank appointment', async () => {
    const fixture = TestBed.createComponent(AgendaPage);
    const page = fixture.componentInstance as unknown as PageHandle;

    await loadInitial(fixture);

    expect(page.config().timeZone).toBe('America/Santiago');
    expect(page.calendarOptions().timeZone).toBe('America/Santiago');

    page.openNew();
    expect(page.formOpen()).toBe(true);
    expect(page.form().durationMinutes).toBe(30);
  });

  it('searches patients by name and selects a result', async () => {
    const fixture = TestBed.createComponent(AgendaPage);
    const page = fixture.componentInstance as unknown as PageHandle;

    await loadInitial(fixture);

    page.onPatientQuery({ target: { value: 'camila' } } as unknown as Event);
    await new Promise((resolve) => setTimeout(resolve, 300));

    http
      .expectOne(
        (request) =>
          request.url === `${BASE}/agenda/patients` && request.params.get('query') === 'camila',
      )
      .flush([AGENDA_PATIENT]);

    await fixture.whenStable();

    page.selectPatient(AGENDA_PATIENT);

    expect(page.patientQuery()).toBe('Camila Rojas Pérez');
    expect(page.selectedPatient()?.id).toBe('patient-1');
    expect(page.form().patientId).toBe('patient-1');
  });

  it('uses the selected calendar span as the appointment duration', async () => {
    const fixture = TestBed.createComponent(AgendaPage);
    const page = fixture.componentInstance as unknown as PageHandle;

    await loadInitial(fixture);

    const select = page.calendarOptions().select;
    expect(select).toBeDefined();

    select?.({
      start: new Date('2026-10-24T12:00:00.000Z'),
      end: new Date('2026-10-24T13:00:00.000Z'),
      allDay: false,
      view: { calendar: { unselect: () => undefined } },
    });

    expect(page.formOpen()).toBe(true);
    expect(page.form().durationMinutes).toBe(60);
    expect(page.form().time).toBe('09:00');
    expect(page.form().date).toBe('2026-10-24');
  });
});

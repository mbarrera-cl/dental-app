import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideAppTransloco, provideSpartanHlm } from 'ui';
import type { Patient } from 'data-access';
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

interface PageHandle {
  config(): typeof CONFIG;
  formOpen(): boolean;
  form(): { durationMinutes: number };
  calendarOptions(): { timeZone?: string };
  openNew(): void;
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

  it('loads config, professionals and patients, then opens a blank appointment', async () => {
    const fixture = TestBed.createComponent(AgendaPage);
    const page = fixture.componentInstance as unknown as PageHandle;

    http.expectOne(`${BASE}/agenda/config`).flush(CONFIG);
    http.expectOne(`${BASE}/agenda/professionals`).flush([
      { id: 'pro-1', name: 'Dra. Ana', email: 'ana@example.com' },
    ]);
    http.expectOne(`${BASE}/agenda/reasons`).flush([
      { id: 'reason-1', name: 'Control', createdAt: '', updatedAt: '' },
    ]);
    http
      .expectOne((request) => request.url === `${BASE}/agenda/patients` && request.params.get('query') === '')
      .flush([PATIENT]);
    http.match(`${BASE}/agenda/appointments`).forEach((request) => request.flush([]));

    await fixture.whenStable();
    fixture.detectChanges();

    expect(page.config().timeZone).toBe('America/Santiago');
    expect(page.calendarOptions().timeZone).toBe('America/Santiago');

    page.openNew();
    expect(page.formOpen()).toBe(true);
    expect(page.form().durationMinutes).toBe(30);
  });
});

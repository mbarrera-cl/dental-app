import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AgendaApi } from './agenda-api';

const BASE = 'http://localhost:3000';

describe('AgendaApi', () => {
  let api: AgendaApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(AgendaApi);
    http = TestBed.inject(HttpTestingController);
  });

  it('loads config, professionals and a date range', () => {
    api.config().subscribe();
    http.expectOne(`${BASE}/agenda/config`).flush({
      timeZone: 'America/Santiago',
      defaultDurationMinutes: 30,
      notifyPatient: true,
      notifyProfessional: true,
    });

    api.professionals().subscribe();
    http.expectOne(`${BASE}/agenda/professionals`).flush([]);

    api.patients('camila').subscribe();
    http
      .expectOne(
        (request) =>
          request.url === `${BASE}/agenda/patients` && request.params.get('query') === 'camila',
      )
      .flush([]);

    api.list('2026-10-19T00:00:00.000Z', '2026-10-26T00:00:00.000Z', 'pro-1').subscribe();
    const list = http.expectOne(
      (request) =>
        request.url === `${BASE}/agenda/appointments` &&
        request.params.get('from') === '2026-10-19T00:00:00.000Z' &&
        request.params.get('to') === '2026-10-26T00:00:00.000Z' &&
        request.params.get('professionalId') === 'pro-1',
    );
    expect(list.request.method).toBe('GET');
    list.flush([]);
  });

  it('checks conflicts and creates, updates and cancels an appointment', () => {
    api
      .conflicts('pro-1', '2026-10-20T14:00:00.000Z', '2026-10-20T14:30:00.000Z')
      .subscribe();
    http
      .expectOne(
        (request) =>
          request.url === `${BASE}/agenda/conflicts` &&
          request.params.get('professionalId') === 'pro-1' &&
          request.params.get('startsAt') === '2026-10-20T14:00:00.000Z' &&
          request.params.get('endsAt') === '2026-10-20T14:30:00.000Z',
      )
      .flush([]);

    const payload = {
      patientId: 'patient-1',
      professionalId: 'pro-1',
      startsAt: '2026-10-20T14:00:00.000Z',
      endsAt: '2026-10-20T14:30:00.000Z',
    };
    api.create(payload).subscribe();
    const create = http.expectOne(`${BASE}/agenda/appointments`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(payload);
    create.flush({ id: 'appointment-1' });

    api.update('appointment-1', { reason: 'Control' }).subscribe();
    const update = http.expectOne(`${BASE}/agenda/appointments/appointment-1`);
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual({ reason: 'Control' });
    update.flush({ id: 'appointment-1' });

    api.cancel('appointment-1').subscribe();
    const cancel = http.expectOne(`${BASE}/agenda/appointments/appointment-1/cancel`);
    expect(cancel.request.method).toBe('POST');
    cancel.flush({ id: 'appointment-1', status: 'cancelled' });
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from './api-base-url';
import { DashboardApi } from './dashboard-api';
import type { DashboardSummary } from './dashboard.model';

const BASE_URL = 'http://api.test/v1/';

const SUMMARY: DashboardSummary = {
  window: {
    today: '2026-10-18T03:00:00.000Z',
    monthStart: '2026-10-01T03:00:00.000Z',
  },
  patients: {
    total: 12,
    newLast30Days: 3,
    prevision: [
      { tipo: 'FONASA', count: 7 },
      { tipo: 'ISAPRE', count: 2 },
      { tipo: 'CONVENIO', count: 1 },
      { tipo: 'PARTICULAR', count: 2 },
    ],
  },
  cash: {
    outstanding: 45000,
    chargesMonth: 120000,
    collectionsToday: [
      { method: 'efectivo', total: 15000 },
      { method: 'tarjeta', total: 0 },
      { method: 'transferencia', total: 5000 },
    ],
    collectionsMonth: [
      { method: 'efectivo', total: 80000 },
      { method: 'tarjeta', total: 20000 },
      { method: 'transferencia', total: 20000 },
    ],
    topDebtors: [{ patientId: 'patient-1', patientName: 'Camila Rojas', balance: 30000 }],
  },
  quotes: {
    funnel: { borrador: 2, sin_respuesta: 3, aprobada: 4, rechazada: 1 },
    approvedMonth: 90000,
    conversionRate: 0.8,
    expiringSoon: 1,
  },
  agenda: {
    today: [{ status: 'scheduled', count: 5 }],
    cancelledMonth: 2,
    totalMonth: 20,
    next: [
      {
        id: 'appointment-1',
        startsAt: '2026-10-18T13:00:00.000Z',
        patientName: 'Camila Rojas',
        professionalName: 'Dra. Díaz',
        reason: 'Control',
      },
    ],
  },
  recentActivity: [
    {
      at: '2026-10-18T12:30:00.000Z',
      actor: 'Administrator',
      action: 'payments.payment.record',
      module: 'payments',
      subject: 'Camila Rojas',
      outcome: 'success',
    },
  ],
};

describe('DashboardApi', () => {
  let api: DashboardApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE_URL },
      ],
    });

    api = TestBed.inject(DashboardApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('fetches the aggregated summary from the dashboard endpoint', () => {
    let received: DashboardSummary | null = null;

    api.summary().subscribe((summary) => (received = summary));

    const request = http.expectOne(`${BASE_URL}dashboard/summary`);
    expect(request.request.method).toBe('GET');
    request.flush(SUMMARY);

    expect(received).toEqual(SUMMARY);
  });
});

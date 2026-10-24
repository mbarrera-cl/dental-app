import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from './api-base-url';
import { PaymentsApi } from './payments-api';
import type { Ledger, Movement } from './payment.model';

const BASE_URL = 'http://api.test/v1/';

const MOVEMENT: Movement = {
  id: 'movement-1',
  kind: 'abono',
  amount: 5000,
  signedAmount: -5000,
  method: 'transferencia',
  reference: 'op/42 BancoEstado',
  concept: 'Abono parcial anual',
  patientId: 'patient-1',
  quoteId: null,
  appointmentId: null,
  createdBy: 'user-1',
  createdAt: '2026-10-17T10:00:00.000Z',
  voidedAt: null,
  voidedBy: null,
  voidReason: null,
};

const LEDGER: Ledger = {
  balance: 10000,
  movements: [MOVEMENT],
  total: 1,
  limit: 50,
  offset: 10,
};

describe('PaymentsApi', () => {
  let api: PaymentsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE_URL },
      ],
    });

    api = TestBed.inject(PaymentsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('records a charge on the nested patient route', () => {
    api.recordCharge('patient-1', { amount: 15000, concept: 'Consulta' }).subscribe();

    const request = http.expectOne('http://api.test/v1/patients/patient-1/ledger/charges');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ amount: 15000, concept: 'Consulta' });
    request.flush(MOVEMENT);
  });

  it('records a payment with its method and reference', () => {
    api
      .recordPayment('patient-1', {
        amount: 5000,
        concept: 'Abono parcial anual',
        method: 'transferencia',
        reference: 'op/42 BancoEstado',
      })
      .subscribe();

    const request = http.expectOne('http://api.test/v1/patients/patient-1/ledger/payments');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      amount: 5000,
      concept: 'Abono parcial anual',
      method: 'transferencia',
      reference: 'op/42 BancoEstado',
    });
    request.flush(MOVEMENT);
  });

  it('fetches the ledger (history + balance) with paging params', () => {
    let received: Ledger | undefined;
    api.ledger('patient-1', { limit: 50, offset: 10 }).subscribe((ledger) => (received = ledger));

    const request = http.expectOne((req) => req.url === 'http://api.test/v1/patients/patient-1/ledger');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('limit')).toBe('50');
    expect(request.request.params.get('offset')).toBe('10');
    request.flush(LEDGER);

    expect(received).toEqual(LEDGER);
  });

  it('voids a movement with the reason in the body', () => {
    api.void('movement-1', 'pago duplicado').subscribe();

    const request = http.expectOne('http://api.test/v1/ledger/movement-1/void');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ reason: 'pago duplicado' });
    request.flush(MOVEMENT);
  });

  it('gets one movement by id, encoded', () => {
    api.get('id with spaces').subscribe();

    http.expectOne('http://api.test/v1/ledger/id%20with%20spaces').flush(MOVEMENT);
  });

  it('asks for the cash summary (close of day)', () => {
    let received: unknown;
    api.cashSummary({ from: '2026-10-01', to: '2026-10-17' }).subscribe((summary) => (received = summary));

    const request = http.expectOne((req) => req.url === 'http://api.test/v1/ledger/cash-summary');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('from')).toBe('2026-10-01');
    expect(request.request.params.get('to')).toBe('2026-10-17');
    request.flush([{ method: 'efectivo', total: 12000 }]);

    expect(received).toEqual([{ method: 'efectivo', total: 12000 }]);
  });
});

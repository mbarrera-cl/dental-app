import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from './api-base-url';
import { QuotesApi } from './quotes-api';
import type { Quote, QuoteVersion } from './quote.model';

const BASE_URL = 'http://api.test/v1/';

const QUOTE: Quote = {
  id: 'quote-1',
  folio: 'COT-2026-0001',
  patientId: 'patient-1',
  patientName: 'Camila Rojas Pérez',
  patientRut: '12345678-5',
  patientEmail: null,
  status: 'borrador',
  validUntil: '2026-11-16T00:00:00.000Z',
  notes: null,
  subtotal: 14000,
  discountTotal: 1000,
  total: 13000,
  approvedTotal: 0,
  version: 1,
  replacesQuoteId: null,
  createdByName: 'Ana',
  createdAt: '2026-10-17T10:00:00.000Z',
  updatedByName: 'Ana',
  updatedAt: '2026-10-17T10:00:00.000Z',
  sanctionedByName: null,
  sanctionedAt: null,
  deletedAt: null,
  deletedByName: null,
  items: [],
};

describe('QuotesApi', () => {
  let api: QuotesApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE_URL },
      ],
    });

    api = TestBed.inject(QuotesApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('lists quotations with the filters', () => {
    let received: Quote[] | undefined;
    api.list({ patientId: 'patient-1', status: 'borrador' }).subscribe((quotes) => (received = quotes));

    const request = http.expectOne((req) => req.url === 'http://api.test/v1/quotes');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('patientId')).toBe('patient-1');
    expect(request.request.params.get('status')).toBe('borrador');
    request.flush([QUOTE]);

    expect(received).toEqual([QUOTE]);
  });

  it('gets a quote by id', () => {
    api.getById('quote-1').subscribe();
    http.expectOne('http://api.test/v1/quotes/quote-1').flush(QUOTE);
  });

  it('creates a quote with POST and the payload', () => {
    api
      .create({
        patientId: 'patient-1',
        items: [{ description: 'Obturación', quantity: 1, unitPrice: 4000 }],
      })
      .subscribe();

    const request = http.expectOne('http://api.test/v1/quotes');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toMatchObject({ patientId: 'patient-1' });
    request.flush(QUOTE);
  });

  it('updates a quote with PUT and an encoded id', () => {
    api.update('id with spaces', { items: [] }).subscribe();

    const request = http.expectOne('http://api.test/v1/quotes/id%20with%20spaces');
    expect(request.request.method).toBe('PUT');
    request.flush(QUOTE);
  });

  it('duplicates a quote with an empty POST body', () => {
    api.duplicate('quote-1').subscribe();

    const request = http.expectOne('http://api.test/v1/quotes/quote-1/duplicate');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush(QUOTE);
  });

  it('decides an item status', () => {
    api.decideItem('quote-1', 'item-1', 'aprobado').subscribe();

    const request = http.expectOne('http://api.test/v1/quotes/quote-1/items/item-1/status');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ status: 'aprobado' });
    request.flush(QUOTE);
  });

  it('changes the workflow status of a quote', () => {
    api.setStatus('quote-1', 'sin_respuesta').subscribe();

    const request = http.expectOne('http://api.test/v1/quotes/quote-1/status');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ status: 'sin_respuesta' });
    request.flush(QUOTE);
  });

  it('lists the version trail', () => {
    let received: QuoteVersion[] | undefined;
    api.versions('quote-1').subscribe((versions) => (received = versions));

    const versions: QuoteVersion[] = [
      {
        id: 'v1',
        version: 1,
        action: 'created',
        snapshot: '{}',
        actorName: 'Ana',
        createdAt: '2026-10-17T10:00:00.000Z',
      },
    ];

    http.expectOne('http://api.test/v1/quotes/quote-1/versions').flush(versions);
    expect(received).toEqual(versions);
  });

  it('lists the trash when asked', () => {
    api.list({ patientId: 'patient-1', deleted: 'only' }).subscribe();

    const request = http.expectOne((req) => req.url === 'http://api.test/v1/quotes');
    expect(request.request.params.get('deleted')).toBe('only');
    expect(request.request.params.get('patientId')).toBe('patient-1');
    request.flush([]);
  });

  it('restores a quote from the trash', () => {
    let received: Quote | undefined;
    api.restore('quote-1').subscribe((quote) => (received = quote));

    const request = http.expectOne('http://api.test/v1/quotes/quote-1/restore');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush(QUOTE);

    expect(received).toEqual(QUOTE);
  });

  it('deletes a draft', () => {
    api.delete('quote-1').subscribe();

    const request = http.expectOne('http://api.test/v1/quotes/quote-1');
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 200, statusText: 'OK' });
  });
});

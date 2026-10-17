import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from './api-base-url';
import { UcoApi } from './uco-api';
import type { UcoProcedure } from './uco.model';

const BASE_URL = 'http://api.test/v1/';

const PROCEDURE: UcoProcedure = {
  id: 'uco-1',
  code: '010001',
  chapter: '1',
  name: 'Consulta dental',
  units: 1.5,
  status: 'active',
  createdAt: '2026-10-17T10:00:00.000Z',
  updatedAt: '2026-10-17T10:00:00.000Z',
};

describe('UcoApi', () => {
  let api: UcoApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE_URL },
      ],
    });

    api = TestBed.inject(UcoApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('lists the catalog with the search term', () => {
    let received: UcoProcedure[] | undefined;
    api.list('consulta').subscribe((procedures) => (received = procedures));

    const request = http.expectOne((req) => req.url === 'http://api.test/v1/uco');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('q')).toBe('consulta');
    expect(request.request.params.has('active')).toBe(false);
    request.flush([PROCEDURE]);

    expect(received).toEqual([PROCEDURE]);
  });

  it('filters active entries only', () => {
    api.list('', true).subscribe();
    const request = http.expectOne((req) => req.url === 'http://api.test/v1/uco');
    expect(request.request.params.get('active')).toBe('true');
    request.flush([]);
  });

  it('creates a procedure', () => {
    api.create({ code: '010001', chapter: '1', name: 'Consulta', units: 1 }).subscribe();

    const request = http.expectOne('http://api.test/v1/uco');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toMatchObject({ code: '010001', units: 1 });
    request.flush(PROCEDURE);
  });

  it('patches a procedure, encoding the id', () => {
    api.update('id with spaces', { units: 2 }).subscribe();

    const request = http.expectOne('http://api.test/v1/uco/id%20with%20spaces');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ units: 2 });
    request.flush(PROCEDURE);
  });

  it('deletes (soft-deletes) a procedure', () => {
    api.delete('uco-1').subscribe();

    const request = http.expectOne('http://api.test/v1/uco/uco-1');
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 200, statusText: 'OK' });
  });
});

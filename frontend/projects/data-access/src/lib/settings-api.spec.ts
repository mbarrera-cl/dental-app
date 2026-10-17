import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from './api-base-url';
import type { Setting, SettingsExport } from './setting.model';
import { SettingsApi } from './settings-api';

const BASE_URL = 'http://api.test/v1/';

const MIN_LENGTH: Setting = {
  key: 'passwordPolicy.minLength',
  group: 'passwordPolicy',
  type: 'number',
  value: 8,
  default: 8,
  min: 6,
  max: 64,
  description: 'Minimum password length',
};

describe('SettingsApi', () => {
  let api: SettingsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE_URL },
      ],
    });

    api = TestBed.inject(SettingsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('lists the merged definitions', () => {
    let settings: Setting[] | undefined;
    api.list().subscribe((value) => {
      settings = value;
    });

    const request = http.expectOne(`${BASE_URL}settings`);
    expect(request.request.method).toBe('GET');

    request.flush([MIN_LENGTH]);
    expect(settings).toEqual([MIN_LENGTH]);
  });

  it('patches only the changed values and returns the merged list', () => {
    api.update({ values: { 'passwordPolicy.minLength': 10 } }).subscribe();

    const request = http.expectOne(`${BASE_URL}settings`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ values: { 'passwordPolicy.minLength': 10 } });

    request.flush([{ ...MIN_LENGTH, value: 10 }]);
  });

  it('exports the transferable envelope', () => {
    let exported: SettingsExport | undefined;
    api.export().subscribe((value) => {
      exported = value;
    });

    const request = http.expectOne(`${BASE_URL}settings/export`);
    expect(request.request.method).toBe('GET');

    const envelope: SettingsExport = {
      app: 'hexa',
      version: 1,
      exportedAt: '2026-10-16T12:00:00.000Z',
      values: { 'passwordPolicy.minLength': 10 },
    };

    request.flush(envelope);
    expect(exported).toEqual(envelope);
  });

  it('imports a values map and returns the merged list', () => {
    api.import({ values: { 'clinic.name': 'Clínica Los Andes' } }).subscribe();

    const request = http.expectOne(`${BASE_URL}settings/import`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ values: { 'clinic.name': 'Clínica Los Andes' } });

    request.flush([{ ...MIN_LENGTH, value: 10 }]);
  });

  it('requests the audit trail with a limit', () => {
    api.audit(5).subscribe();

    const request = http.expectOne(`${BASE_URL}settings/audit?limit=5`);
    expect(request.request.method).toBe('GET');

    request.flush([
      {
        id: 'audit-1',
        at: '2026-10-16T12:00:00.000Z',
        actorId: 'user-1',
        actorType: 'user',
        actorEmail: 'admin@hexa.local',
        changes: [{ key: 'clinic.name', from: 'Mi clínica', to: 'Clínica Los Andes' }],
      },
    ]);
  });
});

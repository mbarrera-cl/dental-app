import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from './api-base-url';
import type { Setting } from './setting.model';
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
});

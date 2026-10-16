import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from './api-base-url';
import { ApiKeysApi } from './api-keys-api';
import type { ApiKey } from './api-key.model';

const BASE_URL = 'http://api.test/v1/';

const KEY: ApiKey = {
  id: 'key-1',
  userId: 'user-1',
  name: 'CI pipeline',
  prefix: 'hexa_ab12',
  scopes: null,
  expiresAt: '2026-12-01T00:00:00.000Z',
  lastUsedAt: null,
  revokedAt: null,
  createdAt: '2026-10-16T10:00:00.000Z',
};

describe('ApiKeysApi', () => {
  let api: ApiKeysApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE_URL },
      ],
    });

    api = TestBed.inject(ApiKeysApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('lists the keys of the caller by default', () => {
    api.list().subscribe();

    const request = http.expectOne(`${BASE_URL}apikeys`);
    expect(request.request.method).toBe('GET');

    request.flush([KEY]);
  });

  it('lists the keys of another user when a userId is given', () => {
    api.list('user 9').subscribe();

    const request = http.expectOne(`${BASE_URL}apikeys?userId=user%209`);
    request.flush([]);
  });

  it('creates a key and reads the plain secret', () => {
    let secret: string | undefined;
    api.create({ name: 'CI', scopes: ['users:read'] }).subscribe((created) => {
      secret = created.key;
    });

    const request = http.expectOne(`${BASE_URL}apikeys`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ name: 'CI', scopes: ['users:read'] });

    request.flush({ ...KEY, key: 'hexa_plain_secret' });
    expect(secret).toBe('hexa_plain_secret');
  });

  it('rotates a key', () => {
    api.rotate('key-1').subscribe();

    const request = http.expectOne(`${BASE_URL}apikeys/key-1/rotate`);
    expect(request.request.method).toBe('POST');

    request.flush({ ...KEY, key: 'hexa_new_secret' });
  });

  it('revokes a key', () => {
    api.revoke('key-1').subscribe();

    const request = http.expectOne(`${BASE_URL}apikeys/key-1`);
    expect(request.request.method).toBe('DELETE');

    request.flush(null, { status: 204, statusText: 'No Content' });
  });
});

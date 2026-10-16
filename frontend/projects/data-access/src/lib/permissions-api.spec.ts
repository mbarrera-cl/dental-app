import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from './api-base-url';
import type { PermissionCatalog } from './permission.model';
import { PermissionsApi } from './permissions-api';

const BASE_URL = 'http://api.test/v1/';

const CATALOG: PermissionCatalog = {
  categories: [
    {
      id: 'users',
      description: 'User administration',
      permissions: [{ key: 'users:read', action: 'read', description: 'List users' }],
    },
  ],
};

describe('PermissionsApi', () => {
  let api: PermissionsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE_URL },
      ],
    });

    api = TestBed.inject(PermissionsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('fetches the grouped catalog', () => {
    let catalog: PermissionCatalog | undefined;
    api.getCatalog().subscribe((value) => {
      catalog = value;
    });

    const request = http.expectOne(`${BASE_URL}permissions`);
    expect(request.request.method).toBe('GET');

    request.flush(CATALOG);
    expect(catalog).toEqual(CATALOG);
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from './api-base-url';
import { RolesApi } from './roles-api';
import type { Role } from './role.model';

const BASE_URL = 'http://api.test/v1/';

const SUPPORT: Role = {
  id: 'role-1',
  name: 'support',
  description: 'First-level support',
  permissions: ['users:read'],
  builtIn: false,
  userCount: 3,
  createdAt: '2026-10-16T10:00:00.000Z',
  updatedAt: '2026-10-16T11:00:00.000Z',
};

describe('RolesApi', () => {
  let api: RolesApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE_URL },
      ],
    });

    api = TestBed.inject(RolesApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('lists roles', () => {
    let roles: Role[] | undefined;
    api.list().subscribe((value) => {
      roles = value;
    });

    const request = http.expectOne(`${BASE_URL}roles`);
    expect(request.request.method).toBe('GET');

    request.flush([SUPPORT]);
    expect(roles).toEqual([SUPPORT]);
  });

  it('creates a role with its permission keys', () => {
    api.create({ name: 'support', permissions: ['users:read'] }).subscribe();

    const request = http.expectOne(`${BASE_URL}roles`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ name: 'support', permissions: ['users:read'] });

    request.flush(SUPPORT);
  });

  it('updates a role', () => {
    api.update('role-1', { permissions: ['users:read', 'users:update'] }).subscribe();

    const request = http.expectOne(`${BASE_URL}roles/role-1`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ permissions: ['users:read', 'users:update'] });

    request.flush({ ...SUPPORT, permissions: ['users:read', 'users:update'] });
  });

  it('encodes ids and removes a role', () => {
    api.remove('role 1').subscribe();

    const request = http.expectOne(`${BASE_URL}roles/role%201`);
    expect(request.request.method).toBe('DELETE');

    request.flush(null, { status: 204, statusText: 'No Content' });
  });
});

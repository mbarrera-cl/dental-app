import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from './api-base-url';
import { AuthApi } from './auth-api';
import type { AuthProfile, AuthSession } from './auth.model';

const BASE_URL = 'http://api.test/v1/';

const SESSION: AuthSession = {
  accessToken: 'jwt-token',
  expiresIn: 900,
  user: { id: 'user-1', email: 'ada@example.com', name: 'Ada Lovelace', status: 'active' },
  roles: [{ id: 'role-1', name: 'admin' }],
  permissions: { fromRoles: ['users:read'], direct: [], effective: ['users:read'] },
};

describe('AuthApi', () => {
  let api: AuthApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE_URL },
      ],
    });

    api = TestBed.inject(AuthApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('posts credentials for login and lets the cookie travel', () => {
    let result: AuthSession | undefined;
    api.login({ email: 'ada@example.com', password: 'secret' }).subscribe((session) => {
      result = session;
    });

    const request = http.expectOne(`${BASE_URL}auth/login`);
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body).toEqual({ email: 'ada@example.com', password: 'secret' });

    request.flush(SESSION);
    expect(result).toEqual(SESSION);
  });

  it('refreshes with credentials and no body', () => {
    api.refresh().subscribe();

    const request = http.expectOne(`${BASE_URL}auth/refresh`);
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body).toBeNull();

    request.flush(SESSION);
  });

  it('logs out with credentials', () => {
    api.logout().subscribe();

    const request = http.expectOne(`${BASE_URL}auth/logout`);
    expect(request.request.withCredentials).toBe(true);
    request.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('fetches the current profile', () => {
    let profile: AuthProfile | undefined;
    api.me().subscribe((value) => {
      profile = value;
    });

    const request = http.expectOne(`${BASE_URL}auth/me`);
    expect(request.request.method).toBe('GET');

    request.flush({ user: SESSION.user, roles: SESSION.roles, permissions: SESSION.permissions });
    expect(profile?.user.email).toBe('ada@example.com');
  });

  it('changes the password and returns the fresh session', () => {
    let result: AuthSession | undefined;
    api.changePassword({ currentPassword: 'old', newPassword: 'new' }).subscribe((session) => {
      result = session;
    });

    const request = http.expectOne(`${BASE_URL}auth/change-password`);
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body).toEqual({ currentPassword: 'old', newPassword: 'new' });

    request.flush(SESSION);
    expect(result?.accessToken).toBe('jwt-token');
  });

  it('supports the forced change of an expired password', () => {
    api
      .changeExpiredPassword({
        email: 'ada@example.com',
        currentPassword: 'old',
        newPassword: 'new',
      })
      .subscribe();

    const request = http.expectOne(`${BASE_URL}auth/change-expired-password`);
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body).toEqual({
      email: 'ada@example.com',
      currentPassword: 'old',
      newPassword: 'new',
    });

    request.flush(SESSION);
  });
});

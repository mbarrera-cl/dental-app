import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthApi, type AuthSession } from 'data-access';
import { firstValueFrom, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authInterceptor } from './auth.interceptor';
import { SessionStore } from './session-store';

const SESSION: AuthSession = {
  accessToken: 'token-1',
  expiresIn: 900,
  user: { id: 'user-1', email: 'ada@example.com', name: 'Ada Lovelace', status: 'active' },
  roles: [],
  permissions: { fromRoles: ['users:read'], direct: [], effective: ['users:read'] },
};

const FRESH: AuthSession = { ...SESSION, accessToken: 'token-2' };

describe('authInterceptor', () => {
  let api: {
    login: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
    changePassword: ReturnType<typeof vi.fn>;
  };
  let router: { url: string; navigate: ReturnType<typeof vi.fn> };
  let http: HttpTestingController;
  let httpClient: HttpClient;
  let store: SessionStore;

  const signIn = () => firstValueFrom(store.login({ email: 'ada@example.com', password: 'x' }));

  beforeEach(() => {
    api = {
      login: vi.fn(() => of(SESSION)),
      refresh: vi.fn(() => of(FRESH)),
      logout: vi.fn(() => of(undefined)),
      changePassword: vi.fn(() => of(SESSION)),
    };
    router = { url: '/users', navigate: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthApi, useValue: api },
        { provide: Router, useValue: router },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    httpClient = TestBed.inject(HttpClient);
    store = TestBed.inject(SessionStore);
  });

  it('attaches the in-memory token and sends cookies on API calls', async () => {
    await signIn();

    httpClient.get('http://api.test/users').subscribe();

    const request = http.expectOne('http://api.test/users');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token-1');
    expect(request.request.withCredentials).toBe(true);
    request.flush([]);
  });

  it('never attaches a token to session endpoints', async () => {
    await signIn();

    httpClient.post('http://api.test/auth/logout', null).subscribe();

    const request = http.expectOne('http://api.test/auth/logout');
    expect(request.request.headers.has('Authorization')).toBe(false);
    expect(request.request.withCredentials).toBe(true);
    request.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('refreshes exactly once on 401 and retries the original request', async () => {
    await signIn();

    let received: number[] | undefined;
    httpClient.get<number[]>('http://api.test/users').subscribe((value) => {
      received = value;
    });

    http.expectOne('http://api.test/users').flush('expired', { status: 401, statusText: 'Unauthorized' });

    const retry = http.expectOne('http://api.test/users');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer token-2');
    retry.flush([1, 2]);

    expect(received).toEqual([1, 2]);
    expect(api.refresh).toHaveBeenCalledTimes(1);
    expect(store.accessToken()).toBe('token-2');
  });

  it('clears the session and redirects to /login when the refresh fails', async () => {
    await signIn();
    api.refresh.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));

    let error: unknown;
    httpClient.get('http://api.test/users').subscribe({ error: (caught: unknown) => (error = caught) });

    http.expectOne('http://api.test/users').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect(store.isAuthenticated()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/users' },
    });
  });

  it('propagates 401s of anonymous requests without refreshing', () => {
    let status: number | undefined;
    httpClient
      .get('http://api.test/users')
      .subscribe({ error: (caught: HttpErrorResponse) => (status = caught.status) });

    http.expectOne('http://api.test/users').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(status).toBe(401);
    expect(api.refresh).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does not refresh when the session endpoints themselves fail', () => {
    httpClient.post('http://api.test/auth/refresh', null).subscribe({ error: () => undefined });

    http.expectOne('http://api.test/auth/refresh').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(api.refresh).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});

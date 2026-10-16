import { TestBed } from '@angular/core/testing';
import { AuthApi, type AuthSession } from 'data-access';
import { firstValueFrom, Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionStore } from './session-store';

const SESSION: AuthSession = {
  accessToken: 'token-1',
  expiresIn: 900,
  user: { id: 'user-1', email: 'ada@example.com', name: 'Ada Lovelace', status: 'active' },
  roles: [{ id: 'role-1', name: 'editor' }],
  permissions: {
    fromRoles: ['users:read'],
    direct: ['users:create'],
    effective: ['users:read', 'users:create'],
  },
};

const CREDENTIALS = { email: 'ada@example.com', password: 'secret' };

describe('SessionStore', () => {
  let api: {
    login: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
    changePassword: ReturnType<typeof vi.fn>;
    changeExpiredPassword: ReturnType<typeof vi.fn>;
  };
  let store: SessionStore;

  beforeEach(() => {
    api = {
      login: vi.fn(() => of(SESSION)),
      refresh: vi.fn(() => of(SESSION)),
      logout: vi.fn(() => of(undefined)),
      changePassword: vi.fn(() => of(SESSION)),
      changeExpiredPassword: vi.fn(() => of(SESSION)),
    };

    TestBed.configureTestingModule({ providers: [{ provide: AuthApi, useValue: api }] });
    store = TestBed.inject(SessionStore);
  });

  it('starts as unknown and lands on anonymous when bootstrap fails', async () => {
    api.refresh.mockReturnValue(throwError(() => new Error('no cookie')));
    expect(store.status()).toBe('unknown');

    await firstValueFrom(store.bootstrap());

    expect(store.status()).toBe('anonymous');
    expect(store.isAuthenticated()).toBe(false);
    expect(store.user()).toBeNull();
  });

  it('bootstraps silently with the refresh cookie', async () => {
    await firstValueFrom(store.bootstrap());

    expect(store.isAuthenticated()).toBe(true);
    expect(store.accessToken()).toBe('token-1');
    expect(store.user()?.email).toBe('ada@example.com');
  });

  it('applies the session on login and evaluates permissions', async () => {
    await firstValueFrom(store.login(CREDENTIALS));

    expect(store.isAuthenticated()).toBe(true);
    expect(store.roles().map((role) => role.name)).toEqual(['editor']);
    expect(store.permissions().effective).toContain('users:create');
    expect(store.has('users:read')).toBe(true);
    expect(store.has('users:delete')).toBe(false);
    expect(store.hasAll('users:read', 'users:create')).toBe(true);
    expect(store.hasAll('users:read', 'users:delete')).toBe(false);
    expect(store.hasAny('users:delete', 'users:create')).toBe(true);
    expect(store.hasAny('roles:read')).toBe(false);
  });

  it('shares a single refresh between concurrent callers (single-flight)', async () => {
    let complete!: (value: AuthSession) => void;
    api.refresh.mockReturnValue(
      new Observable<AuthSession>((subscriber) => {
        complete = (value) => {
          subscriber.next(value);
          subscriber.complete();
        };
      }),
    );

    const first = firstValueFrom(store.refresh());
    const second = firstValueFrom(store.refresh());

    complete(SESSION);

    await expect(first).resolves.toEqual(SESSION);
    await expect(second).resolves.toEqual(SESSION);
    expect(api.refresh).toHaveBeenCalledTimes(1);
    expect(store.isAuthenticated()).toBe(true);
  });

  it('clears the session when a refresh fails and allows retrying later', async () => {
    await firstValueFrom(store.login(CREDENTIALS));

    api.refresh.mockReturnValueOnce(throwError(() => new Error('expired')));
    await expect(firstValueFrom(store.refresh())).rejects.toThrow('expired');

    expect(store.status()).toBe('anonymous');
    expect(store.accessToken()).toBeNull();
    expect(store.has('users:read')).toBe(false);

    await expect(firstValueFrom(store.refresh())).resolves.toEqual(SESSION);
    expect(api.refresh).toHaveBeenCalledTimes(2);
  });

  it('adopts the fresh session after changePassword', async () => {
    await firstValueFrom(store.login(CREDENTIALS));

    const changed = { ...SESSION, accessToken: 'token-2' };
    api.changePassword.mockReturnValue(of(changed));

    await firstValueFrom(store.changePassword({ currentPassword: 'a', newPassword: 'b' }));

    expect(store.accessToken()).toBe('token-2');
    expect(store.isAuthenticated()).toBe(true);
  });

  it('signs the user in after the forced change of an expired password', async () => {
    const renewed = { ...SESSION, accessToken: 'token-3' };
    api.changeExpiredPassword.mockReturnValue(of(renewed));

    await firstValueFrom(
      store.changeExpiredPassword({
        email: 'ada@example.com',
        currentPassword: 'old',
        newPassword: 'new',
      }),
    );

    expect(api.changeExpiredPassword).toHaveBeenCalledWith({
      email: 'ada@example.com',
      currentPassword: 'old',
      newPassword: 'new',
    });
    expect(store.isAuthenticated()).toBe(true);
    expect(store.accessToken()).toBe('token-3');
  });

  it('drops the local session on logout even when the API fails', async () => {
    await firstValueFrom(store.login(CREDENTIALS));

    api.logout.mockReturnValue(throwError(() => new Error('offline')));
    await firstValueFrom(store.logout());

    expect(store.isAuthenticated()).toBe(false);
    expect(store.user()).toBeNull();
    expect(store.permissions().effective).toEqual([]);
  });
});

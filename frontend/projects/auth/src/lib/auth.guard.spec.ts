import { TestBed } from '@angular/core/testing';
import { Router, type UrlSegment } from '@angular/router';
import { firstValueFrom, isObservable, of, type Observable } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authGuard, permissionGuard } from './auth.guard';
import { SessionStore } from './session-store';

type Async<T> = T | Observable<T>;

async function resolve<T>(value: Async<T>): Promise<T> {
  return isObservable(value) ? firstValueFrom(value) : value;
}

interface StoreBehaviour {
  status: 'unknown' | 'anonymous' | 'authenticated';
  permissions: string[];
  /** Simulates the silent bootstrap flipping the store to authenticated. */
  bootstrapAuthenticates: boolean;
}

function storeMock(behaviour: StoreBehaviour): SessionStore {
  const permissions = new Set(behaviour.permissions);
  let authenticated = behaviour.status === 'authenticated';
  let status = behaviour.status;

  return {
    status: () => status,
    isAuthenticated: () => authenticated,
    has: (permission: string) => permissions.has(permission),
    hasAll: (...keys: string[]) => keys.every((key) => permissions.has(key)),
    hasAny: (...keys: string[]) => keys.some((key) => permissions.has(key)),
    bootstrap: () => {
      if (behaviour.bootstrapAuthenticates) {
        authenticated = true;
        status = 'authenticated';
      }

      return of(undefined);
    },
  } as unknown as SessionStore;
}

const SEGMENTS = [{ path: 'admin' }, { path: 'roles' }] as unknown as UrlSegment[];

describe('authGuard', () => {
  let router: { url: string; navigate: ReturnType<typeof vi.fn>; createUrlTree: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    router = {
      url: '/',
      navigate: vi.fn(),
      createUrlTree: vi.fn((commands: unknown[], extras: unknown) => ({ commands, extras })),
    };
  });

  const run = (store: SessionStore) => {
    TestBed.configureTestingModule({
      providers: [
        { provide: SessionStore, useValue: store },
        { provide: Router, useValue: router },
      ],
    });

    return TestBed.runInInjectionContext(() => authGuard({} as never, SEGMENTS, {} as never));
  };

  it('passes an authenticated session through', async () => {
    const result = await resolve(run(storeMock({ status: 'authenticated', permissions: [], bootstrapAuthenticates: false })));

    expect(result).toBe(true);
  });

  it('sends anonymous visitors to /login with the returnUrl', async () => {
    const result = await resolve(run(storeMock({ status: 'anonymous', permissions: [], bootstrapAuthenticates: false })));

    expect(result).not.toBe(true);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/admin/roles' },
    });
  });

  it('bootstraps once on the first navigation and lands on the target route', async () => {
    const result = await resolve(run(storeMock({ status: 'unknown', permissions: [], bootstrapAuthenticates: true })));

    expect(result).toBe(true);
  });

  it('falls back to /login when the silent bootstrap fails', async () => {
    const result = await resolve(run(storeMock({ status: 'unknown', permissions: [], bootstrapAuthenticates: false })));

    expect(result).not.toBe(true);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/admin/roles' },
    });
  });
});

describe('permissionGuard', () => {
  let router: { url: string; navigate: ReturnType<typeof vi.fn>; createUrlTree: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    router = {
      url: '/',
      navigate: vi.fn(),
      createUrlTree: vi.fn((commands: unknown[], extras: unknown) => ({ commands, extras })),
    };
  });

  const run = (store: SessionStore, guard: ReturnType<typeof permissionGuard>) => {
    TestBed.configureTestingModule({
      providers: [
        { provide: SessionStore, useValue: store },
        { provide: Router, useValue: router },
      ],
    });

    return TestBed.runInInjectionContext(() => guard({} as never, SEGMENTS, {} as never));
  };

  it('allows users holding every required key', async () => {
    const guard = permissionGuard({ allOf: ['roles:read', 'settings:read'] });
    const store = storeMock({
      status: 'authenticated',
      permissions: ['roles:read', 'settings:read', 'users:read'],
      bootstrapAuthenticates: false,
    });

    expect(await resolve(run(store, guard))).toBe(true);
  });

  it('sends users missing a required key to /forbidden', async () => {
    const guard = permissionGuard({ allOf: ['roles:read', 'settings:read'] });
    const store = storeMock({ status: 'authenticated', permissions: ['roles:read'], bootstrapAuthenticates: false });

    const result = await resolve(run(store, guard));

    expect(result).not.toBe(true);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/forbidden']);
  });

  it('accepts any of the alternative keys', async () => {
    const guard = permissionGuard({ anyOf: ['roles:read', 'settings:read'] });
    const store = storeMock({
      status: 'authenticated',
      permissions: ['settings:read'],
      bootstrapAuthenticates: false,
    });

    expect(await resolve(run(store, guard))).toBe(true);
  });

  it('rejects users without any of the alternative keys', async () => {
    const guard = permissionGuard({ anyOf: ['roles:read', 'settings:read'] });
    const store = storeMock({
      status: 'authenticated',
      permissions: ['users:read'],
      bootstrapAuthenticates: false,
    });

    const result = await resolve(run(store, guard));

    expect(result).not.toBe(true);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/forbidden']);
  });

  it('sends anonymous users to /login instead of /forbidden', async () => {
    const guard = permissionGuard({ anyOf: ['roles:read'] });
    const store = storeMock({ status: 'anonymous', permissions: [], bootstrapAuthenticates: false });

    const result = await resolve(run(store, guard));

    expect(result).not.toBe(true);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/admin/roles' },
    });
    expect(router.createUrlTree).not.toHaveBeenCalledWith(['/forbidden']);
  });

  it('bootstraps on unknown sessions before deciding', async () => {
    const guard = permissionGuard({ anyOf: ['roles:read'] });
    const store = storeMock({ status: 'unknown', permissions: ['roles:read'], bootstrapAuthenticates: true });

    expect(await resolve(run(store, guard))).toBe(true);
  });
});

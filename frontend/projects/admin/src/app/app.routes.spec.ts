import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, type PartialMatchRouteSnapshot } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { PERMISSION_KEYS, SessionStore } from 'auth';
import { ADMIN_ROUTES, adminHome } from './app.routes';

describe('ADMIN_ROUTES', () => {
  it('is a valid router configuration (NG04014 regression)', () => {
    // A route whose only configuration was a `canMatch` guard made the router
    // throw NG04014 at navigation time: every route needs a component,
    // `redirectTo`, or children.
    TestBed.configureTestingModule({ providers: [provideRouter(ADMIN_ROUTES)] });

    const router = TestBed.inject(Router);

    expect(() => router.resetConfig(ADMIN_ROUTES)).not.toThrow();
  });

  describe('adminHome', () => {
    const redirectWith = (permissions: readonly string[]): unknown => {
      TestBed.configureTestingModule({
        providers: [
          {
            provide: SessionStore,
            useValue: { has: (key: string) => permissions.includes(key) },
          },
        ],
      });

      return TestBed.runInInjectionContext(() => adminHome({} as PartialMatchRouteSnapshot));
    };

    it('sends to roles when the user may read roles', () => {
      expect(redirectWith([PERMISSION_KEYS.roles.read])).toBe('roles');
    });

    it('sends to settings when the user may only read settings', () => {
      expect(redirectWith([PERMISSION_KEYS.settings.read])).toBe('settings');
    });

    it('sends to api-keys when the user may only read api keys', () => {
      expect(redirectWith([PERMISSION_KEYS.apiKeys.read])).toBe('api-keys');
    });

    it('falls back to /forbidden without administration permissions', () => {
      expect(redirectWith([])).toBe('/forbidden');
    });
  });
});

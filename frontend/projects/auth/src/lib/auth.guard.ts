import { inject } from '@angular/core';
import { type CanMatchFn, type UrlSegment, type UrlTree, Router } from '@angular/router';
import { map } from 'rxjs';
import { SessionStore } from './session-store';

export interface PermissionGuardConfig {
  /** Keys that must all be present. */
  allOf?: readonly string[];
  /** Keys of which at least one must be present. */
  anyOf?: readonly string[];
}

function targetUrl(segments: readonly UrlSegment[]): string {
  return `/${segments.map((segment) => segment.path).join('/')}`;
}

function loginTree(router: Router, segments: readonly UrlSegment[]): UrlTree {
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: targetUrl(segments) },
  });
}

/**
 * `canMatch` guard: ensures there is a session before a lazy route loads.
 * The first navigation after a reload is `unknown` — it attempts the silent
 * bootstrap once, so a valid refresh cookie lands straight on the target
 * route; without one the user goes to `/login?returnUrl=…`.
 */
export const authGuard: CanMatchFn = (_route, segments) => {
  const store = inject(SessionStore);
  const router = inject(Router);

  if (store.isAuthenticated()) {
    return true;
  }

  if (store.status() === 'anonymous') {
    return loginTree(router, segments);
  }

  return store.bootstrap().pipe(
    map(() => (store.isAuthenticated() ? true : loginTree(router, segments))),
  );
};

/**
 * `canMatch` guard enforcing permissions: `allOf` must be fully held and, if
 * given, `anyOf` must contribute at least one key. Without a session the user
 * goes to `/login`; with one but lacking keys, to `/forbidden`.
 */
export const permissionGuard = (config: PermissionGuardConfig = {}): CanMatchFn => {
  const allOf = config.allOf ?? [];
  const anyOf = config.anyOf ?? [];

  return (_route, segments) => {
    const store = inject(SessionStore);
    const router = inject(Router);

    const decide = (): boolean | UrlTree => {
      if (!store.isAuthenticated()) {
        return loginTree(router, segments);
      }

      const allowed = store.hasAll(...allOf) && (anyOf.length === 0 || store.hasAny(...anyOf));

      return allowed ? true : router.createUrlTree(['/forbidden']);
    };

    if (store.status() === 'unknown') {
      return store.bootstrap().pipe(map(decide));
    }

    return decide();
  };
};

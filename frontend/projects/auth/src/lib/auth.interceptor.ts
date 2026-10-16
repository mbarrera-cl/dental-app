import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { SessionStore } from './session-store';

/**
 * Session endpoints: they never receive a Bearer header and never trigger a
 * refresh (this is what prevents retry loops).
 */
const AUTH_PATHS = [
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/auth/change-password',
  '/auth/change-expired-password',
] as const;

/**
 * Attaches the in-memory access token, sends cookies and, on the first 401 of
 * a live session, performs exactly one shared refresh and retries the
 * original request. When the refresh fails the store is already cleared and
 * the user lands on the login page with a `returnUrl`.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const store = inject(SessionStore);
  const router = inject(Router);
  const isAuthCall = AUTH_PATHS.some((path) => request.url.includes(path));
  const token = store.accessToken();

  const authorized = request.clone({
    withCredentials: true,
    ...(token !== null && !isAuthCall
      ? { setHeaders: { Authorization: `Bearer ${token}` } }
      : {}),
  });

  return next(authorized).pipe(
    catchError((error: unknown) => {
      const unauthorized = error instanceof HttpErrorResponse && error.status === 401;

      if (!unauthorized || isAuthCall || !store.isAuthenticated()) {
        return throwError(() => error);
      }

      return store.refresh().pipe(
        switchMap((session) =>
          next(
            request.clone({
              withCredentials: true,
              setHeaders: { Authorization: `Bearer ${session.accessToken}` },
            }),
          ),
        ),
        catchError((refreshError: unknown) => {
          void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });

          return throwError(() => refreshError);
        }),
      );
    }),
  );
};

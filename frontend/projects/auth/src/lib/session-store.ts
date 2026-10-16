import { computed, inject, Injectable, signal } from '@angular/core';
import {
  AuthApi,
  type AuthProfile,
  type AuthSession,
  type ChangePasswordPayload,
  type LoginPayload,
} from 'data-access';
import { catchError, finalize, map, Observable, of, shareReplay, tap } from 'rxjs';

export type SessionStatus = 'unknown' | 'anonymous' | 'authenticated';

const EMPTY_PERMISSIONS = {
  fromRoles: [] as string[],
  direct: [] as string[],
  effective: [] as string[],
};

/**
 * The single source of truth of the session, shared by every microfrontend
 * (the lib is a Native Federation singleton). The access token lives in
 * memory only; the refresh token is an httpOnly cookie handled by the
 * browser, so a page reload performs a silent `bootstrap()` instead of
 * re-login.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly api = inject(AuthApi);
  private readonly statusSignal = signal<SessionStatus>('unknown');
  private readonly profileSignal = signal<AuthProfile | null>(null);
  private readonly tokenSignal = signal<string | null>(null);
  private readonly permissionSet = computed(
    () => new Set(this.profileSignal()?.permissions.effective ?? []),
  );
  private refreshInFlight: Observable<AuthSession> | null = null;

  readonly status = this.statusSignal.asReadonly();
  readonly profile = this.profileSignal.asReadonly();
  readonly user = computed(() => this.profileSignal()?.user ?? null);
  readonly roles = computed(() => this.profileSignal()?.roles ?? []);
  readonly permissions = computed(() => this.profileSignal()?.permissions ?? EMPTY_PERMISSIONS);
  readonly isAuthenticated = computed(() => this.statusSignal() === 'authenticated');

  /** In-memory access token; never persisted anywhere. */
  accessToken(): string | null {
    return this.tokenSignal();
  }

  has(permission: string): boolean {
    return this.permissionSet().has(permission);
  }

  hasAll(...permissions: readonly string[]): boolean {
    const set = this.permissionSet();

    return permissions.every((permission) => set.has(permission));
  }

  hasAny(...permissions: readonly string[]): boolean {
    const set = this.permissionSet();

    return permissions.some((permission) => set.has(permission));
  }

  login(payload: LoginPayload): Observable<AuthSession> {
    return this.api.login(payload).pipe(tap((session) => this.apply(session)));
  }

  /**
   * Silent sign-in on app start: exchanges the refresh cookie (if any) for a
   * session. Failures resolve to `anonymous`, they never throw.
   */
  bootstrap(): Observable<void> {
    if (this.statusSignal() === 'authenticated') {
      return of(undefined);
    }

    return this.refresh().pipe(
      map(() => undefined),
      catchError(() => of(undefined)),
    );
  }

  /**
   * Single-flight refresh: concurrent callers (e.g. several 401s) share one
   * request. A failure wipes the local session before rethrowing.
   */
  refresh(): Observable<AuthSession> {
    if (this.refreshInFlight !== null) {
      return this.refreshInFlight;
    }

    const request$: Observable<AuthSession> = this.api.refresh().pipe(
      tap({
        next: (session) => this.apply(session),
        error: () => this.clear(),
      }),
      finalize(() => {
        if (this.refreshInFlight === request$) {
          this.refreshInFlight = null;
        }
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.refreshInFlight = request$;

    return request$;
  }

  /** Changes the password and adopts the freshly issued session. */
  changePassword(payload: ChangePasswordPayload): Observable<AuthSession> {
    return this.api.changePassword(payload).pipe(tap((session) => this.apply(session)));
  }

  /** Best-effort logout: whatever the server says, the local session drops. */
  logout(): Observable<void> {
    return this.api.logout().pipe(
      catchError(() => of(undefined)),
      finalize(() => this.clear()),
    );
  }

  /** Drops the in-memory session (e.g. after a failed refresh). */
  clear(): void {
    this.tokenSignal.set(null);
    this.profileSignal.set(null);
    this.statusSignal.set('anonymous');
  }

  private apply(session: AuthSession): void {
    this.tokenSignal.set(session.accessToken);
    this.profileSignal.set({
      user: session.user,
      roles: session.roles,
      permissions: session.permissions,
    });
    this.statusSignal.set('authenticated');
  }
}

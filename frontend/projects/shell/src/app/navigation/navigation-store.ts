import { effect, inject, Injectable, signal } from '@angular/core';
import { SessionStore } from 'auth';
import { NavigationApi, type MenuItem } from 'data-access';
import { EMPTY, Subject, Subscription, catchError, exhaustMap, finalize } from 'rxjs';

/**
 * Single source of truth for the sidebar: the *filtered* menu tree served by
 * `GET /navigation` (the server already prunes entries the principal cannot
 * see). Reloads on login and logout, and after every editor mutation; it
 * never polls.
 *
 * The fetch is a `Subject` drained by `exhaustMap`, not a direct `subscribe`
 * inside `load()`: fetching inside the session `effect` made the write to
 * `loadingSignal` re-enter that same effect, which re-armed the fetch and
 * spun an endless `GET /navigation` storm (the "navigation loop").
 */
@Injectable({ providedIn: 'root' })
export class NavigationStore {
  private readonly api = inject(NavigationApi);
  private readonly session = inject(SessionStore);
  private readonly treeSignal = signal<readonly MenuItem[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly mobileOpenSignal = signal(false);

  /** Pending fetch request; `exhaustMap` ignores it while one is in flight. */
  private readonly fetchRequests = new Subject<void>();
  private readonly subscription: Subscription;

  readonly tree = this.treeSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  /** Drawer state on small screens (presentation state shared with the header). */
  readonly mobileOpen = this.mobileOpenSignal.asReadonly();

  constructor() {
    this.subscription = this.fetchRequests
      .pipe(
        exhaustMap(() => {
          this.loadingSignal.set(true);

          return this.api.getMine().pipe(
            catchError(() => EMPTY),
            // A failed refresh must still release the "loading" flag.
            finalize(() => this.loadingSignal.set(false)),
          );
        }),
      )
      .subscribe((tree) => {
        this.treeSignal.set(tree);
      });

    // Session transitions drive the reload: sign-in fetches the tree,
    // sign-out (or an expired session) empties it. The effect only *reads*
    // signals; the fetch runs outside of it (see the class docs).
    effect(() => {
      const status = this.session.status();

      if (status === 'authenticated') {
        this.fetchRequests.next();
      } else if (status === 'anonymous') {
        this.treeSignal.set([]);
      }
    });
  }

  /** Called from `provideAppInitializer`, right after `SessionStore.bootstrap()`. */
  init(): void {
    if (this.session.isAuthenticated()) {
      this.fetchRequests.next();
    }
  }

  /**
   * Asks for a fresh tree. Concurrent calls collapse into the request already
   * in flight — the sidebar keeps the last good tree if it fails.
   */
  load(): void {
    this.fetchRequests.next();
  }

  openMobile(): void {
    this.mobileOpenSignal.set(true);
  }

  closeMobile(): void {
    this.mobileOpenSignal.set(false);
  }

  /** Releases the internal stream (the store lives as long as the app). */
  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.fetchRequests.complete();
  }
}

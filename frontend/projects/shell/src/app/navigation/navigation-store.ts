import { effect, inject, Injectable, signal } from '@angular/core';
import { SessionStore } from 'auth';
import { NavigationApi, type MenuItem } from 'data-access';
import { catchError, of } from 'rxjs';

/**
 * Single source of truth for the sidebar: the *filtered* menu tree served by
 * `GET /navigation` (the server already prunes entries the principal cannot
 * see). Reloads on login and logout, and after every editor mutation; it
 * never polls.
 */
@Injectable({ providedIn: 'root' })
export class NavigationStore {
  private readonly api = inject(NavigationApi);
  private readonly session = inject(SessionStore);
  private readonly treeSignal = signal<readonly MenuItem[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly mobileOpenSignal = signal(false);

  readonly tree = this.treeSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  /** Drawer state on small screens (presentation state shared with the header). */
  readonly mobileOpen = this.mobileOpenSignal.asReadonly();

  constructor() {
    // Session transitions drive the reload: sign-in fetches the tree,
    // sign-out (or an expired session) empties it.
    effect(() => {
      const status = this.session.status();

      if (status === 'authenticated') {
        this.load();
      } else if (status === 'anonymous') {
        this.treeSignal.set([]);
      }
    });
  }

  /** Called from `provideAppInitializer`, right after `SessionStore.bootstrap()`. */
  init(): void {
    if (this.session.isAuthenticated()) {
      this.load();
    }
  }

  /**
   * Refetches the tree. Concurrent calls are ignored while one is in flight —
   * the sidebar keeps the last good tree if the request fails.
   */
  load(): void {
    if (this.loadingSignal()) {
      return;
    }

    this.loadingSignal.set(true);

    this.api
      .getMine()
      .pipe(catchError(() => of(null)))
      .subscribe((tree) => {
        if (tree !== null) {
          this.treeSignal.set(tree);
        }

        this.loadingSignal.set(false);
      });
  }

  openMobile(): void {
    this.mobileOpenSignal.set(true);
  }

  closeMobile(): void {
    this.mobileOpenSignal.set(false);
  }
}

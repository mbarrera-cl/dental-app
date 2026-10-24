import { computed, inject, Injectable, signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs';
import {
  ActivityApi,
  DEFAULT_ACTIVITY_CONFIG,
  mapApiError,
  type ActivityEntry,
  type ActivityOutcome,
  type ActivityPanelConfig,
  type ActivityPurgeQuery,
  type ActivityPurgeResult,
  type ActivityQuery,
} from 'data-access';

export interface ActivityFilters {
  module: string | null;
  outcome: ActivityOutcome | null;
  from: string | null;
  to: string | null;
  /** Narrow to one actor (the page uses it for “only mine”). */
  actorId: string | null;
}

const LAST_SEEN_KEY = 'hexa.activity.lastSeenAt';

/**
 * Shared state of the activity panel and page. The list is keyset-paginated;
 * `load(true)` replaces it (filters/refresh) and `loadMore()` appends.
 *
 * Badge state is device-local (`localStorage`): the panel is an informational
 * trail, not an inbox, so there is no per-user cursor table on the backend.
 */
@Injectable({ providedIn: 'root' })
export class ActivityStore {
  private readonly api = inject(ActivityApi);

  private readonly itemsSignal = signal<ActivityEntry[]>([]);
  private readonly configSignal = signal<ActivityPanelConfig>(DEFAULT_ACTIVITY_CONFIG);
  private readonly loadingSignal = signal(false);
  private readonly loadingMoreSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly cursorSignal = signal<string | null>(null);
  private readonly filtersSignal = signal<ActivityFilters>({
    module: null,
    outcome: null,
    from: null,
    to: null,
    actorId: null,
  });
  private readonly lastSeenSignal = signal(readLastSeen());
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly items = this.itemsSignal.asReadonly();
  readonly config = this.configSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly loadingMore = this.loadingMoreSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly filters = this.filtersSignal.asReadonly();
  readonly hasMore = computed(() => this.cursorSignal() !== null);
  readonly unreadCount = computed(() => {
    const lastSeen = this.lastSeenSignal();

    return this.itemsSignal().filter((entry) => entry.at > lastSeen).length;
  });

  /** Replaces the current page (or loads it for the first time). */
  load(limit?: number, markSeen = false): void {
    if (this.loadingSignal()) {
      return;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    this.api.list(this.query(limit)).subscribe({
      next: (page) => {
        this.configSignal.set(page.config);
        this.itemsSignal.set(page.items);
        this.cursorSignal.set(page.nextCursor);

        if (markSeen) {
          this.markSeen();
        }

        if (this.timer === null && page.config.refreshSeconds > 0) {
          this.startPolling();
        }
      },
      error: (error: unknown) => {
        this.errorSignal.set(mapApiError(error));
        this.loadingSignal.set(false);
      },
      complete: () => this.loadingSignal.set(false),
    });
  }

  /** Appends the next page, de-duplicating entries already shown. */
  loadMore(limit?: number): void {
    const cursor = this.cursorSignal();

    if (cursor === null || this.loadingMoreSignal() || this.loadingSignal()) {
      return;
    }

    this.loadingMoreSignal.set(true);

    this.api.list({ ...this.query(limit), cursor }).subscribe({
      next: (page) => {
        const known = new Set(this.itemsSignal().map((entry) => entry.id));
        const fresh = page.items.filter((entry) => !known.has(entry.id));

        this.itemsSignal.update((items) => [...items, ...fresh]);
        this.cursorSignal.set(page.nextCursor);
      },
      error: (error: unknown) => {
        this.errorSignal.set(mapApiError(error));
        this.loadingMoreSignal.set(false);
      },
      complete: () => this.loadingMoreSignal.set(false),
    });
  }

  /** Silent refresh that keeps the current filters. */
  refresh(): void {
    if (!this.configSignal().enabled) {
      return;
    }

    this.api.list(this.query()).subscribe({
      next: (page) => {
        this.configSignal.set(page.config);
        this.itemsSignal.set(page.items);
        this.cursorSignal.set(page.nextCursor);
      },
      error: () => {
        // A failed background refresh must not replace the visible list.
      },
    });
  }

  setFilters(patch: Partial<ActivityFilters>): void {
    this.filtersSignal.update((filters) => ({ ...filters, ...patch }));
    this.load();
  }

  clearFilters(): void {
    this.filtersSignal.set({
      module: null,
      outcome: null,
      from: null,
      to: null,
      actorId: null,
    });
    this.load();
  }

  /** Remembers the newest entry the user has already seen. */
  markSeen(): void {
    const latest = this.itemsSignal()[0]?.at;

    if (latest === undefined) {
      return;
    }

    writeLastSeen(latest);
    this.lastSeenSignal.set(latest);
  }

  /** Refreshes every `activity.panelRefreshSeconds` while the tab is visible. */
  startPolling(): void {
    this.stopPolling();

    const seconds = this.configSignal().refreshSeconds;

    if (seconds <= 0) {
      return;
    }

    this.timer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        this.refresh();
      }
    }, seconds * 1000);
  }

  stopPolling(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  purge(query: ActivityPurgeQuery): Observable<ActivityPurgeResult> {
    return this.api.purge(query).pipe(tap(() => this.load()));
  }

  previewPurge(query: ActivityPurgeQuery): Observable<{ count: number }> {
    return this.api.previewPurge(query);
  }

  reset(): void {
    this.stopPolling();
    this.itemsSignal.set([]);
    this.cursorSignal.set(null);
    this.errorSignal.set(null);
    this.filtersSignal.set({
      module: null,
      outcome: null,
      from: null,
      to: null,
      actorId: null,
    });
  }

  private query(limit?: number): ActivityQuery {
    const filters = this.filtersSignal();

    return {
      limit: limit ?? this.configSignal().panelLimit,
      ...(filters.module === null ? {} : { module: filters.module }),
      ...(filters.outcome === null ? {} : { outcome: filters.outcome }),
      ...(filters.from === null ? {} : { from: filters.from }),
      ...(filters.to === null ? {} : { to: filters.to }),
      ...(filters.actorId === null ? {} : { actorId: filters.actorId }),
    };
  }
}

function readLastSeen(): string {
  try {
    // First visit: everything already in the trail counts as seen; only newer
    // entries light up the badge.
    return localStorage.getItem(LAST_SEEN_KEY) ?? new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function writeLastSeen(value: string): void {
  try {
    localStorage.setItem(LAST_SEEN_KEY, value);
  } catch {
    // Private mode: the badge simply starts over next visit.
  }
}

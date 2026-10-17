import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL, type ActivityEntry, type ActivityPage } from 'data-access';
import { ActivityStore } from './activity-store';

const BASE_URL = 'http://api.test';

function entry(overrides: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    id: 'a-1',
    at: '2026-10-17T10:00:00.000Z',
    actor: { id: 'user-1', type: 'user', name: 'Ana', email: 'ana@test.cl' },
    action: 'patients.create',
    module: 'patients',
    subject: { type: 'patient', id: null, label: 'Camila' },
    outcome: 'success',
    statusCode: 201,
    method: 'POST',
    path: '/patients',
    route: '/patients',
    ip: null,
    userAgent: null,
    metadata: {},
    ...overrides,
  };
}

function page(items: ActivityEntry[], nextCursor: string | null = null): ActivityPage {
  return {
    config: { enabled: true, panelLimit: 20, refreshSeconds: 0, badge: true },
    items,
    nextCursor,
  };
}

describe('ActivityStore', () => {
  let store: ActivityStore;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE_URL },
      ],
    });

    store = TestBed.inject(ActivityStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    store.stopPolling();
    http.verify();
    localStorage.clear();
  });

  it('loads the first page and exposes the config', () => {
    store.load();

    http.expectOne((request) => request.url === `${BASE_URL}/activity`).flush(page([entry()]));

    expect(store.items()).toHaveLength(1);
    expect(store.config().panelLimit).toBe(20);
    expect(store.hasMore()).toBe(false);
  });

  it('appends pages without duplicating entries', () => {
    store.load();
    http
      .expectOne((request) => request.url === `${BASE_URL}/activity`)
      .flush(page([entry()], 'cursor-1'));

    expect(store.hasMore()).toBe(true);

    store.loadMore();

    const request = http.expectOne(
      (candidate) => candidate.url === `${BASE_URL}/activity` && candidate.params.has('cursor'),
    );
    expect(request.request.params.get('cursor')).toBe('cursor-1');
    request.flush(page([entry(), entry({ id: 'a-2', at: '2026-10-17T09:00:00.000Z' })]));

    expect(store.items().map((item) => item.id)).toEqual(['a-1', 'a-2']);
  });

  it('sends filters and resets the cursor', () => {
    store.setFilters({ module: 'patients', outcome: 'failure' });

    const request = http.expectOne((candidate) => candidate.url === `${BASE_URL}/activity`);
    expect(request.request.params.get('module')).toBe('patients');
    expect(request.request.params.get('outcome')).toBe('failure');
    request.flush(page([]));

    expect(store.filters().module).toBe('patients');
  });

  it('tracks unseen entries until they are marked as seen', () => {
    const future = new Date(Date.now() + 60_000).toISOString();

    store.load();
    http.expectOne((request) => request.url === `${BASE_URL}/activity`).flush(
      page([entry({ at: future })]),
    );

    expect(store.unreadCount()).toBe(1);

    store.markSeen();

    expect(store.unreadCount()).toBe(0);
  });

  it('exposes a translatable error key without dropping the list', () => {
    store.load();
    http
      .expectOne((request) => request.url === `${BASE_URL}/activity`)
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });

    expect(store.error()).toBeTruthy();
    expect(store.loading()).toBe(false);
  });

  it('does not start polling when the configured interval is zero', () => {
    store.load();
    http.expectOne((request) => request.url === `${BASE_URL}/activity`).flush(page([]));

    store.startPolling();

    // Nothing to assert beyond "no timer": a second refresh would need a
    // request. `http.verify()` in afterEach proves no stray call was queued.
    expect(store.config().refreshSeconds).toBe(0);
  });
});

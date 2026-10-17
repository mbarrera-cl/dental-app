import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SessionStore } from 'auth';
import type { MenuItem } from 'data-access';
import { NavigationStore } from './navigation-store';

const SESSION = {
  accessToken: 'token-1',
  expiresIn: 900,
  user: { id: 'user-1', email: 'admin@hexa.local', name: 'Admin', status: 'active' },
  roles: [{ id: 'role-1', name: 'admin' }],
  permissions: { fromRoles: [], direct: [], effective: ['patients:read'] },
};

const PATIENTS: MenuItem = {
  id: 'menu-1',
  kind: 'item',
  label: null,
  icon: 'lucideStethoscope',
  routeKey: 'patients',
  externalUrl: null,
  parentId: null,
  position: 0,
  requiredPermission: 'patients:read',
  enabled: true,
  children: [],
};

describe('NavigationStore', () => {
  let store: NavigationStore;
  let session: SessionStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    store = TestBed.inject(NavigationStore);
    session = TestBed.inject(SessionStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  /** Signs in synchronously through the auth API (no change detection needed). */
  const signIn = async (): Promise<void> => {
    const done = new Promise<void>((resolve) => {
      session.login({ email: 'admin@hexa.local', password: 'secret' }).subscribe(() => resolve());
    });

    http.expectOne('http://localhost:3000/auth/login').flush(SESSION);
    await done;
  };

  it('does not fetch anything while the session is anonymous', () => {
    store.init();

    http.expectNone('http://localhost:3000/navigation');
    expect(store.tree()).toEqual([]);
    expect(store.loading()).toBe(false);
  });

  it('loads the permission-filtered tree when initialized with a session', async () => {
    await signIn();

    store.init();

    const request = http.expectOne('http://localhost:3000/navigation');
    expect(request.request.method).toBe('GET');
    request.flush([PATIENTS]);

    expect(store.tree()).toEqual([PATIENTS]);
    expect(store.loading()).toBe(false);
  });

  it('shares one in-flight request between concurrent loads', () => {
    store.load();
    store.load();

    const request = http.expectOne('http://localhost:3000/navigation');
    expect(store.loading()).toBe(true);

    request.flush([PATIENTS]);

    expect(store.tree()).toEqual([PATIENTS]);
    expect(store.loading()).toBe(false);
  });

  it('keeps the last good tree when a refresh fails', () => {
    store.load();
    http.expectOne('http://localhost:3000/navigation').flush([PATIENTS]);

    store.load();
    http
      .expectOne('http://localhost:3000/navigation')
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });

    expect(store.tree()).toEqual([PATIENTS]);
    expect(store.loading()).toBe(false);
  });

  it('toggles the mobile drawer state', () => {
    expect(store.mobileOpen()).toBe(false);

    store.openMobile();
    expect(store.mobileOpen()).toBe(true);

    store.closeMobile();
    expect(store.mobileOpen()).toBe(false);
  });
});

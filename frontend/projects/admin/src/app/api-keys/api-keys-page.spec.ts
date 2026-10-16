import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { FormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { SessionStore } from 'auth';
import type { ApiKey, PermissionCatalog, Role, User } from 'data-access';
import { provideAppTransloco, provideSpartanHlm } from 'ui';
import { ApiKeysPage } from './api-keys-page';

const BASE = 'http://localhost:3000';
const KEYS_URL = `${BASE}/apikeys?all=true`;
const USERS_URL = `${BASE}/users`;
const ROLES_URL = `${BASE}/roles`;
const CATALOG_URL = `${BASE}/permissions`;

const ADMIN_ROLE: Role = {
  id: 'role-admin',
  name: 'admin',
  description: 'Full access',
  permissions: ['users:read', 'dashboard:read'],
  builtIn: true,
  userCount: 1,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const EDITOR_ROLE: Role = {
  ...ADMIN_ROLE,
  id: 'role-editor',
  name: 'editor',
  description: 'Edits content',
  permissions: ['dashboard:read'],
  builtIn: false,
};

const USERS: User[] = [
  {
    id: 'user-1',
    email: 'ada@example.com',
    name: 'Ada Lovelace',
    createdAt: '2026-10-01T08:00:00.000Z',
    roles: [{ id: 'role-admin', name: 'admin' }],
    directPermissions: ['users:read'],
    status: 'active',
    lastLoginAt: null,
    mustChangePassword: false,
  },
  {
    id: 'user-2',
    email: 'grace@example.com',
    name: 'Grace Hopper',
    createdAt: '2026-10-02T08:00:00.000Z',
    roles: [{ id: 'role-editor', name: 'editor' }],
    directPermissions: [],
    status: 'active',
    lastLoginAt: null,
    mustChangePassword: false,
  },
];

const KEYS: ApiKey[] = [
  {
    id: 'key-1',
    userId: 'user-1',
    name: 'Admin key',
    prefix: 'hexa_aaaa1111',
    scopes: null,
    expiresAt: null,
    lastUsedAt: null,
    revokedAt: null,
    createdAt: '2026-10-05T00:00:00.000Z',
  },
  {
    id: 'key-2',
    userId: 'user-2',
    name: 'Editor key',
    prefix: 'hexa_bbbb2222',
    scopes: ['dashboard:read'],
    expiresAt: '2027-01-01T00:00:00.000Z',
    lastUsedAt: '2026-10-10T00:00:00.000Z',
    revokedAt: null,
    createdAt: '2026-10-06T00:00:00.000Z',
  },
];

const CATALOG: PermissionCatalog = {
  categories: [
    {
      id: 'users',
      description: 'User administration',
      permissions: [{ key: 'users:read', action: 'read', description: 'Read users' }],
    },
    {
      id: 'dashboard',
      description: 'Dashboard',
      permissions: [{ key: 'dashboard:read', action: 'read', description: 'See stats' }],
    },
  ],
};

/** Minimal callable-signal shape, so the spec can read and set page state. */
interface Signal<T> {
  (): T;
  set(value: T): void;
}

/** Protected members of the page, reachable from the spec (like api-keys-page.spec). */
interface PageHandle {
  query: Signal<string>;
  createOpen: Signal<boolean>;
  createForm: FormGroup;
  scopesMode: Signal<'inherit' | 'subset'>;
  selectedScopes: Signal<readonly string[]>;
  secret: Signal<string | null>;
  targetCatalog(): PermissionCatalog | null;
  openCreate(): void;
  setScopesMode(mode: 'inherit' | 'subset'): void;
  submitCreate(): void;
  askRotate(key: ApiKey): void;
  confirmRotate(): void;
  askRevoke(key: ApiKey): void;
  confirmRevoke(): void;
}

describe('AdminApiKeysPage', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApiKeysPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAppTransloco(),
        provideSpartanHlm(),
        // The page only asks the session whether it may act; grant everything.
        { provide: SessionStore, useValue: { has: () => true, hasAll: () => true, hasAny: () => true } },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  function render(keys: ApiKey[] = KEYS): ComponentFixture<ApiKeysPage> {
    const fixture = TestBed.createComponent(ApiKeysPage);
    fixture.detectChanges();
    http.expectOne(KEYS_URL).flush(keys);
    http.expectOne(USERS_URL).flush(USERS);
    fixture.detectChanges();

    return fixture;
  }

  function handle(fixture: ComponentFixture<ApiKeysPage>): PageHandle {
    return fixture.componentInstance as unknown as PageHandle;
  }

  function native(fixture: ComponentFixture<ApiKeysPage>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function click(fixture: ComponentFixture<ApiKeysPage>, testId: string): void {
    const button = native(fixture).querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
    expect(button).not.toBeNull();
    button!.click();
    fixture.detectChanges();
  }

  /** Opens the create dialog and settles its lazy loads (roles + catalog). */
  function openCreate(fixture: ComponentFixture<ApiKeysPage>): void {
    click(fixture, 'admin-keys-create');
    http.expectOne(ROLES_URL).flush([ADMIN_ROLE, EDITOR_ROLE]);
    http.expectOne(CATALOG_URL).flush(CATALOG);
    fixture.detectChanges();
  }

  it('lists every key with its owner, scopes and status', () => {
    const fixture = render();

    const rows = native(fixture).querySelectorAll('[data-testid="admin-key-row"]');
    expect(rows.length).toBe(2);
    expect(native(fixture).textContent).toContain('ada@example.com');
    expect(native(fixture).textContent).toContain('grace@example.com');
    expect(native(fixture).textContent).toContain('Todos los permisos del usuario');
    expect(native(fixture).textContent).toContain('Sin caducidad');
  });

  it('filters by owner email, name or prefix', () => {
    const fixture = render();

    const search = native(fixture).querySelector<HTMLInputElement>('[data-testid="admin-keys-search"]');
    search!.value = 'grace';
    search!.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const rows = native(fixture).querySelectorAll('[data-testid="admin-key-row"]');
    expect(rows.length).toBe(1);
    expect(native(fixture).textContent).toContain('Editor key');
    expect(native(fixture).textContent).not.toContain('Admin key');
  });

  it('creates an inheriting key on behalf of another user', () => {
    const fixture = render();
    const page = handle(fixture);

    openCreate(fixture);
    page.createForm.controls['userId'].setValue('user-2');
    page.createForm.controls['name'].setValue('CI pipeline');
    page.submitCreate();
    fixture.detectChanges();

    const request = http.expectOne(`${BASE}/apikeys`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'CI pipeline',
      userId: 'user-2',
      expiresInDays: 90,
      scopes: null,
    });
    request.flush({ ...KEYS[1], id: 'key-3', key: 'hexa_cccc3333_secret' });
    fixture.detectChanges();

    expect(page.createOpen()).toBe(false);
    expect(page.secret()).toBe('hexa_cccc3333_secret');
    http.expectOne(KEYS_URL).flush(KEYS);
  });

  it('limits the scope picker to the permissions of the target user', () => {
    const fixture = render();
    const page = handle(fixture);

    openCreate(fixture);
    page.createForm.controls['userId'].setValue('user-2');
    page.createForm.controls['name'].setValue('Read only');
    page.setScopesMode('subset');
    fixture.detectChanges();

    // Only `dashboard:read` (the editor role) can be delegated to user-2.
    expect(page.selectedScopes()).toEqual(['dashboard:read']);
    const catalog = page.targetCatalog();
    expect(catalog?.categories.map((category) => category.id)).toEqual(['dashboard']);

    page.submitCreate();
    fixture.detectChanges();

    const request = http.expectOne(`${BASE}/apikeys`);
    expect(request.request.body).toEqual({
      name: 'Read only',
      userId: 'user-2',
      expiresInDays: 90,
      scopes: ['dashboard:read'],
    });
    request.flush({ ...KEYS[1], id: 'key-4', key: 'hexa_dddd4444_secret' });
    fixture.detectChanges();
    http.expectOne(KEYS_URL).flush(KEYS);
  });

  it('rotates a key and shows the new secret once', () => {
    const fixture = render();
    const page = handle(fixture);

    page.askRotate(KEYS[0]);
    fixture.detectChanges();
    page.confirmRotate();
    fixture.detectChanges();

    const request = http.expectOne(`${BASE}/apikeys/key-1/rotate`);
    expect(request.request.method).toBe('POST');
    request.flush({ ...KEYS[0], key: 'hexa_eeee5555_rotated' });
    fixture.detectChanges();

    expect(page.secret()).toBe('hexa_eeee5555_rotated');
    http.expectOne(KEYS_URL).flush(KEYS);
  });

  it('revokes a key after confirmation', () => {
    const fixture = render();
    const page = handle(fixture);

    page.askRevoke(KEYS[0]);
    fixture.detectChanges();
    page.confirmRevoke();
    fixture.detectChanges();

    const request = http.expectOne(`${BASE}/apikeys/key-1`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
    fixture.detectChanges();

    http.expectOne(KEYS_URL).flush([KEYS[1]]);
  });
});

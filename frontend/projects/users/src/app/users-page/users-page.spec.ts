import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { FormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { SessionStore } from 'auth';
import type { PermissionCatalog, Role, User } from 'data-access';
import { formatDateTime, provideAppTransloco, provideSpartanHlm } from 'ui';
import { UsersPage } from './users-page';

const BASE = 'http://localhost:3000';
const USERS_URL = `${BASE}/users`;
const ROLES_URL = `${BASE}/roles`;
const CATALOG_URL = `${BASE}/permissions`;

const EDITOR_ROLE: Role = {
  id: 'role-editor',
  name: 'editor',
  description: 'Edits content',
  permissions: ['dashboard:read'],
  builtIn: false,
  userCount: 1,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const ADMIN_ROLE: Role = {
  ...EDITOR_ROLE,
  id: 'role-admin',
  name: 'admin',
  description: 'Full access',
  permissions: ['users:read', 'roles:read'],
  builtIn: true,
};

const CATALOG: PermissionCatalog = {
  categories: [
    {
      id: 'users',
      description: 'User administration',
      permissions: [
        { key: 'users:read', action: 'read', description: 'Read users' },
        { key: 'users:create', action: 'create', description: 'Create users' },
      ],
    },
    {
      id: 'dashboard',
      description: 'Dashboard',
      permissions: [{ key: 'dashboard:read', action: 'read', description: 'See stats' }],
    },
  ],
};

const USERS: User[] = [
  {
    id: 'user-1',
    email: 'ada@example.com',
    name: 'Ada Lovelace',
    createdAt: '2026-10-01T08:00:00.000Z',
    roles: [{ id: 'role-editor', name: 'editor' }],
    directPermissions: ['users:read'],
    status: 'active',
    lastLoginAt: '2026-10-10T09:30:00.000Z',
    mustChangePassword: true,
  },
  {
    id: 'user-2',
    email: 'grace@example.com',
    name: 'Grace Hopper',
    createdAt: '2026-10-02T08:00:00.000Z',
    roles: [],
    directPermissions: [],
    status: 'disabled',
    lastLoginAt: null,
    mustChangePassword: false,
  },
];

/** Protected members of the page, reachable from the spec (like api-keys-page.spec). */
interface PageHandle {
  form: FormGroup;
  formRoles: { (): readonly string[]; set(value: readonly string[]): void };
  formStatus: { set(value: 'active' | 'disabled'): void };
  resetMode: { set(value: 'typed' | 'generate'): void };
  resetValue: { set(value: string): void };
  resetError(): string | null;
  generatedPassword(): string | null;
  inheritedPermissions(): readonly string[];
  openCreate(): void;
  openEdit(user: User): void;
  openReset(user: User): void;
  openPermissions(user: User): void;
  askDelete(user: User): void;
  onRolesSelected(roleIds: readonly string[] | null | undefined): void;
  submitForm(): void;
  submitReset(): void;
  savePermissions(): void;
  confirmDelete(): void;
}

describe('UsersPage', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsersPage],
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

  function render(users: User[] = USERS): ComponentFixture<UsersPage> {
    const fixture = TestBed.createComponent(UsersPage);
    fixture.detectChanges();
    http.expectOne(USERS_URL).flush(users);
    fixture.detectChanges();

    return fixture;
  }

  function handle(fixture: ComponentFixture<UsersPage>): PageHandle {
    return fixture.componentInstance as unknown as PageHandle;
  }

  function native(fixture: ComponentFixture<UsersPage>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('shows skeleton rows while loading', () => {
    const fixture = TestBed.createComponent(UsersPage);
    fixture.detectChanges();

    expect(native(fixture).querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);

    http.expectOne(USERS_URL).flush([]);
  });

  it('renders roles, status, direct permissions and last login', () => {
    const fixture = render();

    const compiled = native(fixture);
    expect(compiled.textContent).toContain('Ada Lovelace');
    expect(compiled.textContent).toContain('grace@example.com');
    expect(compiled.textContent).toContain('2 de 2 usuarios');

    // Roles and account state.
    expect(compiled.textContent).toContain('editor');
    expect(compiled.textContent).toContain('Sin roles');
    expect(compiled.textContent).toContain('Activo');
    expect(compiled.textContent).toContain('Deshabilitado');
    expect(compiled.textContent).toContain('Cambio pendiente');

    // Direct permissions counter and last login (never logged in for user-2).
    expect(compiled.querySelector('[data-testid="user-direct-permissions"]')?.textContent).toContain('+1');
    expect(compiled.textContent).toContain(formatDateTime(USERS[0].lastLoginAt!, 'es'));
    expect(compiled.textContent).toContain('Nunca');
  });

  it('filters users as you type in the search box', () => {
    const fixture = render();
    const compiled = native(fixture);

    const search = compiled.querySelector<HTMLInputElement>('[data-testid="users-search"]');
    expect(search).not.toBeNull();

    search!.value = 'ada';
    search!.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Ada Lovelace');
    expect(compiled.textContent).not.toContain('Grace Hopper');
  });

  it('shows a translated error banner when the API is unreachable', () => {
    const fixture = TestBed.createComponent(UsersPage);
    fixture.detectChanges();

    http.expectOne(USERS_URL).error(new ProgressEvent('error'));

    fixture.detectChanges();

    expect(native(fixture).textContent).toContain('No se pudo conectar con la API');
  });

  it('creates a user with roles, status and an optional password', () => {
    const fixture = render();
    const page = handle(fixture);

    page.openCreate();
    fixture.detectChanges();
    http.expectOne(ROLES_URL).flush([ADMIN_ROLE, EDITOR_ROLE]);

    page.form.setValue({ name: 'New Person', email: 'new@example.com', password: 'Str0ng-Pass!' });
    page.formRoles.set(['role-editor']);
    page.formStatus.set('disabled');
    page.submitForm();

    const request = http.expectOne(USERS_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'New Person',
      email: 'new@example.com',
      password: 'Str0ng-Pass!',
      roles: ['role-editor'],
      status: 'disabled',
    });

    request.flush({ ...USERS[0], id: 'user-3', name: 'New Person', email: 'new@example.com' });
    http.expectOne(USERS_URL).flush(USERS);
  });

  it('omits the password when it is left empty', () => {
    const fixture = render();
    const page = handle(fixture);

    page.openCreate();
    fixture.detectChanges();
    http.expectOne(ROLES_URL).flush([ADMIN_ROLE]);

    page.form.setValue({ name: 'New Person', email: 'new@example.com', password: '' });
    page.submitForm();

    const request = http.expectOne(USERS_URL);
    expect(request.request.body).toEqual({
      name: 'New Person',
      email: 'new@example.com',
      roles: [],
      status: 'active',
    });
    expect(request.request.body).not.toHaveProperty('password');

    request.flush({ ...USERS[0], id: 'user-3' });
    http.expectOne(USERS_URL).flush(USERS);
  });

  it('edits a user replacing roles and status', () => {
    const fixture = render();
    const page = handle(fixture);

    page.openEdit(USERS[0]);
    fixture.detectChanges();
    http.expectOne(ROLES_URL).flush([ADMIN_ROLE, EDITOR_ROLE]);

    page.form.setValue({ name: 'Ada King', email: 'ada@example.com', password: '' });
    page.formRoles.set(['role-admin']);
    page.formStatus.set('disabled');
    page.submitForm();

    const request = http.expectOne(`${USERS_URL}/user-1`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({
      name: 'Ada King',
      email: 'ada@example.com',
      roles: ['role-admin'],
      status: 'disabled',
    });

    request.flush({ ...USERS[0], name: 'Ada King' });
    http.expectOne(USERS_URL).flush(USERS);
  });

  it('assigns roles picked from the searchable selector', () => {
    const fixture = render();
    const page = handle(fixture);

    page.openEdit(USERS[0]);
    fixture.detectChanges();
    http.expectOne(ROLES_URL).flush([ADMIN_ROLE, EDITOR_ROLE]);

    page.onRolesSelected(['role-admin', 'role-editor']);
    expect(page.formRoles()).toEqual(['role-admin', 'role-editor']);

    // The `[value]` binding echoes the selection back: equal content must not
    // replace the array (otherwise the binding and the event would loop).
    const current = page.formRoles();
    page.onRolesSelected(['role-editor', 'role-admin']);
    expect(page.formRoles()).toBe(current);

    page.form.setValue({ name: 'Ada Lovelace', email: 'ada@example.com', password: '' });
    page.submitForm();

    const request = http.expectOne(`${USERS_URL}/user-1`);
    expect(request.request.body.roles).toEqual(['role-admin', 'role-editor']);

    request.flush(USERS[0]);
    http.expectOne(USERS_URL).flush(USERS);
  });

  it('keeps the current roles when the catalog cannot be loaded', () => {
    const fixture = render();
    const page = handle(fixture);

    page.openEdit(USERS[0]);
    fixture.detectChanges();
    // No `roles:read`: the picker degrades instead of failing the page.
    http.expectOne(ROLES_URL).flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });

    page.form.setValue({ name: 'Ada King', email: 'ada@example.com', password: '' });
    page.submitForm();

    const request = http.expectOne(`${USERS_URL}/user-1`);
    expect(request.request.body.roles).toEqual(['role-editor']);

    request.flush({ ...USERS[0], name: 'Ada King' });
    http.expectOne(USERS_URL).flush(USERS);
  });

  it('resets a typed password and never echoes it back', () => {
    const fixture = render();
    const page = handle(fixture);

    page.openReset(USERS[0]);
    fixture.detectChanges();
    page.resetMode.set('typed');
    page.resetValue.set('Nueva-Str0ng-456!');
    page.submitReset();

    const request = http.expectOne(`${USERS_URL}/user-1/password`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ password: 'Nueva-Str0ng-456!' });

    request.flush({});
    http.expectOne(USERS_URL).flush(USERS);

    expect(page.generatedPassword()).toBeNull();
  });

  it('asks for a typed password before submitting', () => {
    const fixture = render();
    const page = handle(fixture);

    page.openReset(USERS[0]);
    fixture.detectChanges();
    page.resetMode.set('typed');
    page.submitReset();

    expect(page.resetError()).toBe('users.reset.passwordRequired');
    http.expectNone(`${USERS_URL}/user-1/password`);
  });

  it('generates a password and exposes it exactly once', () => {
    const fixture = render();
    const page = handle(fixture);

    page.openReset(USERS[0]);
    fixture.detectChanges();
    // `generate` is the default mode.
    page.submitReset();

    const request = http.expectOne(`${USERS_URL}/user-1/password`);
    expect(request.request.body).toEqual({ generate: true });

    request.flush({ password: 'Gen-999-Xyz!' });
    http.expectOne(USERS_URL).flush(USERS);

    expect(page.generatedPassword()).toBe('Gen-999-Xyz!');
  });

  it('saves the direct permissions using the permission matrix', () => {
    const fixture = render();
    const page = handle(fixture);

    page.openPermissions(USERS[0]);
    fixture.detectChanges();
    http.expectOne(ROLES_URL).flush([ADMIN_ROLE, EDITOR_ROLE]);
    http.expectOne(CATALOG_URL).flush(CATALOG);
    fixture.detectChanges();

    // Permissions inherited through the `editor` role are computed for the matrix.
    expect(page.inheritedPermissions()).toEqual(['dashboard:read']);

    page.savePermissions();

    const request = http.expectOne(`${USERS_URL}/user-1/permissions`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ permissions: ['users:read'] });

    request.flush(USERS[0]);
    http.expectOne(USERS_URL).flush(USERS);
  });

  it('deletes a user after confirmation', () => {
    const fixture = render();
    const page = handle(fixture);

    page.askDelete(USERS[1]);
    fixture.detectChanges();
    page.confirmDelete();

    const request = http.expectOne(`${USERS_URL}/user-2`);
    expect(request.request.method).toBe('DELETE');

    request.flush(null);
    http.expectOne(USERS_URL).flush([USERS[0]]);
  });
});

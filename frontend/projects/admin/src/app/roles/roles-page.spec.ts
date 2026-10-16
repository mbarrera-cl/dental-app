import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { FormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { SessionStore } from 'auth';
import type { PermissionCatalog, Role } from 'data-access';
import { provideAppTransloco, provideSpartanHlm } from 'ui';
import { RolesPage } from './roles-page';

const BASE = 'http://localhost:3000';
const ROLES_URL = `${BASE}/roles`;
const CATALOG_URL = `${BASE}/permissions`;

const EDITOR_ROLE: Role = {
  id: 'role-editor',
  name: 'editor',
  description: 'Edits content',
  permissions: ['dashboard:read'],
  builtIn: false,
  userCount: 2,
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
  userCount: 1,
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

/** Minimal callable-signal shape, so the spec can read and set page state. */
interface Signal<T> {
  (): T;
  set(value: T): void;
}

/** Protected members of the page, reachable from the spec (like api-keys-page.spec). */
interface PageHandle {
  form: FormGroup;
  formOpen: Signal<boolean>;
  editing: Signal<Role | null>;
  selectedPermissions: Signal<readonly string[]>;
  deleteOpen: Signal<boolean>;
  openCreate(): void;
  openEdit(role: Role): void;
  openDuplicate(role: Role): void;
  askDelete(role: Role): void;
  submitForm(): void;
  confirmDelete(): void;
}

describe('RolesPage', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RolesPage],
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

  function render(roles: Role[] = [EDITOR_ROLE, ADMIN_ROLE]): ComponentFixture<RolesPage> {
    const fixture = TestBed.createComponent(RolesPage);
    fixture.detectChanges();
    http.expectOne(ROLES_URL).flush(roles);
    fixture.detectChanges();

    return fixture;
  }

  function handle(fixture: ComponentFixture<RolesPage>): PageHandle {
    return fixture.componentInstance as unknown as PageHandle;
  }

  function native(fixture: ComponentFixture<RolesPage>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('lists roles with their permissions, users and built-in lock', () => {
    const fixture = render();

    const rows = native(fixture).querySelectorAll('[data-testid="role-row"]');
    expect(rows.length).toBe(2);
    expect(native(fixture).textContent).toContain('editor');
    expect(native(fixture).textContent).toContain('admin');
    expect(native(fixture).textContent).toContain('Sistema');
    // The protected role cannot be deleted from the UI.
    expect(native(fixture).querySelectorAll('[data-testid="role-delete-role-editor"]').length).toBe(1);
    expect(native(fixture).querySelectorAll('[data-testid="role-delete-role-admin"]').length).toBe(0);
  });

  it('creates a role from the permission matrix', () => {
    const fixture = render();
    const page = handle(fixture);

    page.openCreate();
    fixture.detectChanges();
    http.expectOne(CATALOG_URL).flush(CATALOG);
    fixture.detectChanges();

    page.form.controls['name'].setValue('auditor');
    page.selectedPermissions.set(['dashboard:read']);
    page.submitForm();
    fixture.detectChanges();

    const request = http.expectOne(ROLES_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'auditor',
      description: '',
      permissions: ['dashboard:read'],
    });
    request.flush({ ...EDITOR_ROLE, id: 'role-auditor', name: 'auditor' });
    fixture.detectChanges();

    // The dialog closes and the list reloads.
    expect(page.formOpen()).toBe(false);
    http.expectOne(ROLES_URL).flush([EDITOR_ROLE, ADMIN_ROLE]);
  });

  it('duplicates a role with a prefilled name and its permissions', () => {
    const fixture = render();
    const page = handle(fixture);

    page.openDuplicate(EDITOR_ROLE);
    fixture.detectChanges();
    http.expectOne(CATALOG_URL).flush(CATALOG);

    expect(page.editing()).toBeNull();
    expect(page.form.controls['name'].value).toBe('editor (copia)');
    expect(page.selectedPermissions()).toEqual(['dashboard:read']);
  });

  it('edits a built-in role with its name frozen', () => {
    const fixture = render();
    const page = handle(fixture);

    page.openEdit(ADMIN_ROLE);
    fixture.detectChanges();
    http.expectOne(CATALOG_URL).flush(CATALOG);
    fixture.detectChanges();

    // The name control is disabled (frozen); `getRawValue` still submits it.
    expect(page.form.controls['name'].disabled).toBe(true);
    expect(page.selectedPermissions()).toEqual(['users:read', 'roles:read']);
  });

  it('re-enables the name control for regular roles', () => {
    const fixture = render();
    const page = handle(fixture);

    page.openEdit(ADMIN_ROLE);
    fixture.detectChanges();
    http.expectOne(CATALOG_URL).flush(CATALOG);
    expect(page.form.controls['name'].disabled).toBe(true);

    page.openEdit(EDITOR_ROLE);
    fixture.detectChanges();

    expect(page.form.controls['name'].enabled).toBe(true);
    expect(page.form.controls['name'].value).toBe('editor');
  });

  it('deletes a role after confirmation', () => {
    const fixture = render();
    const page = handle(fixture);

    page.askDelete(EDITOR_ROLE);
    fixture.detectChanges();
    expect(page.deleteOpen()).toBe(true);

    page.confirmDelete();
    fixture.detectChanges();

    const request = http.expectOne(`${ROLES_URL}/role-editor`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
    fixture.detectChanges();

    expect(page.deleteOpen()).toBe(false);
    http.expectOne(ROLES_URL).flush([ADMIN_ROLE]);
  });

  it('reloads and explains when the role still has users', () => {
    const fixture = render();
    const page = handle(fixture);

    page.askDelete(EDITOR_ROLE);
    fixture.detectChanges();
    page.confirmDelete();
    fixture.detectChanges();

    const request = http.expectOne(`${ROLES_URL}/role-editor`);
    request.flush(
      { statusCode: 409, error: 'RoleAssignedError', message: 'role in use' },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();

    expect(page.deleteOpen()).toBe(false);
    http.expectOne(ROLES_URL).flush([EDITOR_ROLE, ADMIN_ROLE]);
  });
});

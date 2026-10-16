import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { FormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ApiKey, CreatedApiKey, PermissionCatalog } from 'data-access';
import { provideAppTransloco, provideSpartanHlm } from 'ui';
import { ApiKeysPage } from './api-keys-page';

const BASE = 'http://localhost:3000';
const KEYS_URL = `${BASE}/apikeys`;
const CATALOG_URL = `${BASE}/permissions`;

const ACTIVE_KEY: ApiKey = {
  id: 'key-1',
  userId: 'user-1',
  name: 'CI pipeline',
  prefix: 'hexa_abc123',
  scopes: null,
  expiresAt: '2027-01-01T00:00:00.000Z',
  lastUsedAt: null,
  revokedAt: null,
  createdAt: '2026-10-01T00:00:00.000Z',
};

const REVOKED_KEY: ApiKey = {
  ...ACTIVE_KEY,
  id: 'key-2',
  name: 'Old key',
  revokedAt: '2026-10-02T00:00:00.000Z',
};

const EXPIRED_KEY: ApiKey = {
  ...ACTIVE_KEY,
  id: 'key-3',
  name: 'Stale key',
  expiresAt: '2020-01-01T00:00:00.000Z',
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

/** Protected members of the page, reachable from the spec. */
interface PageHandle {
  createForm: FormGroup;
  scopesMode: { set(value: 'inherit' | 'subset'): void };
  selectedScopes: { set(value: readonly string[]): void };
  secret(): string | null;
  submitCreate(): void;
  confirmRotate(): void;
  confirmRevoke(): void;
  onSecretStateChanged(state: 'open' | 'closed'): void;
}

describe('ApiKeysPage', () => {
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
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  function render(keys: ApiKey[]): ComponentFixture<ApiKeysPage> {
    const fixture = TestBed.createComponent(ApiKeysPage);
    fixture.detectChanges();
    http.expectOne(KEYS_URL).flush(keys);
    fixture.detectChanges();

    return fixture;
  }

  function handle(fixture: ComponentFixture<ApiKeysPage>): PageHandle {
    return fixture.componentInstance as unknown as PageHandle;
  }

  function native(fixture: ComponentFixture<ApiKeysPage>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function click(fixture: ComponentFixture<ApiKeysPage>, testId: string, index = 0): void {
    const buttons = native(fixture).querySelectorAll<HTMLButtonElement>(`[data-testid="${testId}"]`);
    expect(buttons.length).toBeGreaterThan(index);
    buttons[index].click();
    fixture.detectChanges();
  }

  it('lists the keys with their status', () => {
    const fixture = render([ACTIVE_KEY, REVOKED_KEY, EXPIRED_KEY]);

    const rows = native(fixture).querySelectorAll('[data-testid="api-key-row"]');
    expect(rows.length).toBe(3);
    expect(native(fixture).textContent).toContain('CI pipeline');
    expect(native(fixture).textContent).toContain('Activa');
    expect(native(fixture).textContent).toContain('Revocada');
    expect(native(fixture).textContent).toContain('Caducada');
    // Revoked keys cannot be rotated/revoked again.
    expect(native(fixture).querySelectorAll('[data-testid="api-key-revoke"]').length).toBe(2);
  });

  it('creates a key that inherits every permission and shows the secret exactly once', async () => {
    const fixture = render([]);
    click(fixture, 'api-keys-create');
    http.expectOne(CATALOG_URL).flush(CATALOG);
    await fixture.whenStable();

    const page = handle(fixture);
    page.createForm.controls['name'].setValue('CI pipeline');
    page.submitCreate();

    const request = http.expectOne(KEYS_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ name: 'CI pipeline', expiresInDays: 90, scopes: null });
    request.flush({ ...ACTIVE_KEY, key: 'hexa_secret_once' } satisfies CreatedApiKey);
    await fixture.whenStable();

    expect(page.secret()).toBe('hexa_secret_once');

    // Closing the dialog drops the plain secret: it is never retrievable again.
    page.onSecretStateChanged('closed');
    expect(page.secret()).toBeNull();

    http.expectOne(KEYS_URL).flush([ACTIVE_KEY]);
  });

  it('limits the key to the selected permissions when we choose a subset', async () => {
    const fixture = render([]);
    click(fixture, 'api-keys-create');
    http.expectOne(CATALOG_URL).flush(CATALOG);
    await fixture.whenStable();

    const page = handle(fixture);
    page.createForm.controls['name'].setValue('Dashboard bot');
    page.scopesMode.set('subset');
    page.selectedScopes.set(['dashboard:read']);
    fixture.detectChanges();
    page.submitCreate();

    const request = http.expectOne(KEYS_URL);
    expect(request.request.body).toEqual({
      name: 'Dashboard bot',
      expiresInDays: 90,
      scopes: ['dashboard:read'],
    });
    request.flush({ ...ACTIVE_KEY, key: 'hexa_subset' });
    await fixture.whenStable();
    http.expectOne(KEYS_URL).flush([ACTIVE_KEY]);
  });

  it('rotates a key: new secret once, previous secret gone', async () => {
    const fixture = render([ACTIVE_KEY]);
    click(fixture, 'api-key-rotate');

    const page = handle(fixture);
    page.confirmRotate();

    const request = http.expectOne(`${KEYS_URL}/key-1/rotate`);
    expect(request.request.method).toBe('POST');
    request.flush({ ...ACTIVE_KEY, key: 'hexa_rotated' });
    await fixture.whenStable();

    expect(page.secret()).toBe('hexa_rotated');
    http.expectOne(KEYS_URL).flush([ACTIVE_KEY]);
  });

  it('revokes a key after confirmation', async () => {
    const fixture = render([ACTIVE_KEY]);
    click(fixture, 'api-key-revoke');

    const page = handle(fixture);
    page.confirmRevoke();

    const request = http.expectOne(`${KEYS_URL}/key-1`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    http.expectOne(KEYS_URL).flush([REVOKED_KEY]);
    fixture.detectChanges();

    expect(native(fixture).textContent).toContain('Revocada');
    expect(native(fixture).querySelectorAll('[data-testid="api-key-revoke"]').length).toBe(0);
  });
});

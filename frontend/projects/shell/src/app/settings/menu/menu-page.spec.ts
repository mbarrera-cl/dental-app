import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { SessionStore } from 'auth';
import type { MenuItem, PermissionCatalog, Role } from 'data-access';
import { provideAppTransloco, provideSpartanHlm } from 'ui';
import { MenuPage } from './menu-page';

const item = (overrides: Partial<MenuItem>): MenuItem => ({
  id: 'menu-x',
  kind: 'item',
  label: null,
  icon: null,
  routeKey: null,
  externalUrl: null,
  parentId: null,
  position: 0,
  requiredPermission: null,
  enabled: true,
  children: [],
  ...overrides,
});

const TREE: MenuItem[] = [
  item({ id: 'menu-patients', routeKey: 'patients', icon: 'lucideStethoscope' }),
  item({ id: 'menu-divider', kind: 'divider', position: 1 }),
  item({
    id: 'menu-admin',
    kind: 'group',
    label: 'Administración',
    icon: 'lucideSettings',
    position: 2,
    children: [
      item({
        id: 'menu-roles',
        routeKey: 'admin.roles',
        parentId: 'menu-admin',
        requiredPermission: 'roles:read',
      }),
      item({ id: 'menu-users', routeKey: 'users', parentId: 'menu-admin', position: 1, enabled: false }),
    ],
  }),
  item({ id: 'menu-ghost', routeKey: 'ghost.route', position: 3 }),
];

const ROLES: Role[] = [
  {
    id: 'role-viewer',
    name: 'viewer',
    description: 'Read-only',
    permissions: ['patients:read'],
    builtIn: false,
    userCount: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const CATALOG: PermissionCatalog = {
  categories: [
    {
      id: 'patients',
      description: 'Patients',
      permissions: [{ key: 'patients:read', action: 'read', description: 'View patients' }],
    },
    {
      id: 'roles',
      description: 'Roles',
      permissions: [{ key: 'roles:read', action: 'read', description: 'View roles' }],
    },
  ],
};

const API = 'http://localhost:3000';

describe('MenuPage', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MenuPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAppTransloco(),
        provideSpartanHlm(),
        {
          // Only the session reads the page performs: the effective permission
          // set (preview) and the status the NavigationStore effect watches.
          provide: SessionStore,
          useValue: {
            status: () => 'anonymous',
            isAuthenticated: () => false,
            permissions: () => ({ effective: ['patients:read', 'roles:read'] }),
          },
        },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  const render = async (tree: MenuItem[] = TREE): Promise<ComponentFixture<MenuPage>> => {
    const fixture = TestBed.createComponent(MenuPage);
    fixture.detectChanges();

    http.expectOne(`${API}/navigation/items`).flush(tree);
    http.expectOne(`${API}/roles`).flush(ROLES);
    http.expectOne(`${API}/permissions`).flush(CATALOG);

    await fixture.whenStable();
    fixture.detectChanges();

    return fixture;
  };

  const rowFor = (fixture: ComponentFixture<MenuPage>, text: string): HTMLElement => {
    const rows = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('div.cdk-drag'),
    );
    const row = rows.find((candidate) => candidate.textContent?.includes(text));

    expect(row).toBeDefined();
    return row!;
  };

  it('renders the full tree with resolved labels, hidden and unknown markers', async () => {
    const fixture = await render();
    const compiled = fixture.nativeElement as HTMLElement;

    // Registry items resolve their i18n label, groups are literal.
    expect(compiled.textContent).toContain('Pacientes');
    expect(compiled.textContent).toContain('Administración');
    expect(compiled.textContent).toContain('Roles');

    // Hidden entries stay visible for the editor, flagged.
    expect(compiled.textContent).toContain('Oculto');

    // Route keys missing from the registry are flagged for the editor.
    expect(rowFor(fixture, 'ghost.route').querySelector('[aria-label="Ruta desconocida"]')).not.toBeNull();
  });

  it('previews the menu as another role through "view as"', async () => {
    const fixture = await render();
    const compiled = fixture.nativeElement as HTMLElement;
    const preview = (): HTMLElement => compiled.querySelector<HTMLElement>('section[aria-label="Vista previa"]')!;

    // Own view (admin with the full tree): everything visible renders.
    expect(preview().textContent).toContain('Pacientes');
    expect(preview().textContent).toContain('Administración');
    // Unknown route keys never render in the sidebar, so the preview hides them.
    expect(preview().textContent).not.toContain('ghost.route');

    // As the read-only viewer: patients only, the admin group loses every child.
    const select = compiled.querySelector<HTMLSelectElement>('#menu-preview-role')!;
    select.value = 'role-viewer';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(preview().textContent).toContain('Pacientes');
    expect(preview().textContent).not.toContain('Administración');
  });

  it('creates an item through the editor form and reloads the tree', async () => {
    const fixture = await render();
    const compiled = fixture.nativeElement as HTMLElement;

    const newButton = Array.from(compiled.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Nuevo ítem'),
    );
    newButton?.click();
    fixture.detectChanges();

    const label = compiled.querySelector<HTMLInputElement>('#menu-label')!;
    label.value = 'Portal';
    label.dispatchEvent(new Event('input'));

    const route = compiled.querySelector<HTMLSelectElement>('#menu-route')!;
    route.value = 'patients';
    route.dispatchEvent(new Event('change'));

    const submit = compiled.querySelector<HTMLButtonElement>('form button[type="submit"]')!;
    submit.click();
    fixture.detectChanges();

    const request = http.expectOne(`${API}/navigation/items`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      kind: 'item',
      label: 'Portal',
      icon: null,
      routeKey: 'patients',
      externalUrl: null,
      requiredPermission: null,
      enabled: true,
      parentId: null,
    });
    request.flush(item({ id: 'menu-new', label: 'Portal', routeKey: 'patients', position: 4 }));

    http.expectOne(`${API}/navigation/items`).flush(TREE);

    await fixture.whenStable();
    fixture.detectChanges();

    // The editor closes after a successful save.
    expect(compiled.querySelector('#menu-label')).toBeNull();
  });

  it('sends the whole tree as the reorder batch when moving with the arrows', async () => {
    const fixture = await render();
    const row = rowFor(fixture, 'Pacientes');

    row.querySelector<HTMLButtonElement>('[aria-label="Bajar"]')!.click();
    fixture.detectChanges();

    const request = http.expectOne(`${API}/navigation/order`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      items: [
        { id: 'menu-divider', parentId: null, position: 0 },
        { id: 'menu-patients', parentId: null, position: 1 },
        { id: 'menu-admin', parentId: null, position: 2 },
        { id: 'menu-roles', parentId: 'menu-admin', position: 0 },
        { id: 'menu-users', parentId: 'menu-admin', position: 1 },
        { id: 'menu-ghost', parentId: null, position: 3 },
      ],
    });

    // The server response is authoritative for the visible order.
    request.flush(TREE);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(rowFor(fixture, 'Pacientes')).toBeDefined();
  });

  it('hides an entry through the visibility toggle', async () => {
    const fixture = await render();
    const row = rowFor(fixture, 'Pacientes');

    row.querySelector<HTMLButtonElement>('[aria-label="Ocultar"]')!.click();
    fixture.detectChanges();

    const patch = http.expectOne(`${API}/navigation/items/menu-patients`);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ enabled: false });
    patch.flush({ ...TREE[0]!, enabled: false });

    http.expectOne(`${API}/navigation/items`).flush(
      TREE.map((node) =>
        node.id === 'menu-patients' ? { ...node, enabled: false } : node,
      ),
    );

    await fixture.whenStable();
    fixture.detectChanges();

    expect(rowFor(fixture, 'Pacientes').textContent).toContain('Oculto');
  });

  it('validates the form before submitting anything', async () => {
    const fixture = await render();
    const compiled = fixture.nativeElement as HTMLElement;

    compiled
      .querySelectorAll<HTMLButtonElement>('button')
      .forEach((button) => {
        if (button.textContent?.includes('Nuevo ítem')) {
          button.click();
        }
      });
    fixture.detectChanges();

    // A group with no label is rejected client-side.
    compiled.querySelector<HTMLInputElement>('input[type="radio"][value="group"]')!.click();
    compiled.querySelector<HTMLButtonElement>('form button[type="submit"]')!.click();
    fixture.detectChanges();

    expect(compiled.querySelector('[role="alert"]')?.textContent).toContain(
      'El grupo necesita una etiqueta.',
    );
    http.expectNone(`${API}/navigation/items`);

    // An external item needs a valid https URL.
    compiled.querySelector<HTMLInputElement>('input[type="radio"][value="item"]')!.click();
    fixture.detectChanges();
    compiled.querySelector<HTMLInputElement>('input[type="radio"][value="external"]')!.click();
    fixture.detectChanges();

    const url = compiled.querySelector<HTMLInputElement>('#menu-url')!;
    url.value = 'http://insecure.example.com';
    url.dispatchEvent(new Event('input'));
    compiled.querySelector<HTMLButtonElement>('form button[type="submit"]')!.click();
    fixture.detectChanges();

    expect(compiled.querySelector('[role="alert"]')?.textContent).toContain(
      'Introduce una URL https:// válida.',
    );

    // Fixing the URL submits the creation with the external destination.
    url.value = 'https://intranet.example.com';
    url.dispatchEvent(new Event('input'));
    compiled.querySelector<HTMLButtonElement>('form button[type="submit"]')!.click();
    fixture.detectChanges();

    const request = http.expectOne(`${API}/navigation/items`);
    expect(request.request.body).toEqual({
      kind: 'item',
      label: null,
      icon: null,
      routeKey: null,
      externalUrl: 'https://intranet.example.com',
      requiredPermission: null,
      enabled: true,
      parentId: null,
    });
    request.flush(item({ id: 'menu-ext', externalUrl: 'https://intranet.example.com', position: 4 }));
    http.expectOne(`${API}/navigation/items`).flush(TREE);

    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('rolls the optimistic order back when the server rejects the batch', async () => {
    const fixture = await render();
    const firstRow = (): HTMLElement =>
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('div.cdk-drag')[0]!;

    expect(firstRow().textContent).toContain('Pacientes');

    rowFor(fixture, 'Pacientes').querySelector<HTMLButtonElement>('[aria-label="Bajar"]')!.click();
    fixture.detectChanges();

    // Optimistic: the row already moved before the server confirms.
    expect(firstRow().textContent).toContain('Separador');

    http.expectOne(`${API}/navigation/order`).flush('boom', { status: 500, statusText: 'Server Error' });

    // Rollback: the tree is refetched and shows the original order again.
    http.expectOne(`${API}/navigation/items`).flush(TREE);

    await fixture.whenStable();
    fixture.detectChanges();

    expect(firstRow().textContent).toContain('Pacientes');
  });
});

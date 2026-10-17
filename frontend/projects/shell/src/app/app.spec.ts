import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { SessionStore } from 'auth';
import type { AuthSession, MenuItem } from 'data-access';
import { provideAppTransloco, provideSpartanHlm } from 'ui';
import { App } from './app';

const SESSION: AuthSession = {
  accessToken: 'token-1',
  expiresIn: 900,
  user: { id: 'user-1', email: 'admin@hexa.local', name: 'Admin', status: 'active' },
  roles: [{ id: 'role-1', name: 'admin' }],
  permissions: {
    fromRoles: ['users:read', 'dashboard:read', 'roles:read', 'patients:read'],
    direct: [],
    effective: ['users:read', 'dashboard:read', 'roles:read', 'patients:read'],
  },
};

const MENU: MenuItem[] = [
  {
    id: 'menu-patients',
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
  },
  {
    id: 'menu-users',
    kind: 'item',
    label: null,
    icon: 'lucideUsers',
    routeKey: 'users',
    externalUrl: null,
    parentId: null,
    position: 1,
    requiredPermission: 'users:read',
    enabled: true,
    children: [],
  },
  {
    id: 'menu-admin',
    kind: 'group',
    label: 'Administración',
    icon: 'lucideSettings',
    routeKey: null,
    externalUrl: null,
    parentId: null,
    position: 2,
    requiredPermission: null,
    enabled: true,
    children: [
      {
        id: 'menu-roles',
        kind: 'item',
        label: null,
        icon: null,
        routeKey: 'admin.roles',
        externalUrl: null,
        parentId: 'menu-admin',
        position: 0,
        requiredPermission: 'roles:read',
        enabled: true,
        children: [],
      },
    ],
  },
];

describe('App (shell)', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
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

  it('renders the shell chrome for anonymous visitors: no sidebar, sign-in link', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('header')).not.toBeNull();
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
    expect(compiled.querySelector('hlm-toaster')).not.toBeNull();
    expect(compiled.querySelector('app-sidebar')).toBeNull();
    expect(compiled.textContent).toContain('Iniciar sesión');
    // Menu labels never render without a session.
    expect(compiled.textContent).not.toContain('Pacientes');
  });

  it('mounts the database-driven sidebar as soon as the session starts', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const store = TestBed.inject(SessionStore);
    const done = new Promise<void>((resolve) => {
      store.login({ email: 'admin@hexa.local', password: 'secret' }).subscribe(() => resolve());
    });

    http.expectOne('http://localhost:3000/auth/login').flush(SESSION);
    await done;
    fixture.detectChanges();

    // The store reloads on the session transition: settle it with the tree.
    http.expectOne('http://localhost:3000/navigation').flush(MENU);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-sidebar')).not.toBeNull();
    expect(compiled.querySelector('a[href="/patients"]')?.textContent).toContain('Pacientes');
    expect(compiled.textContent).toContain('Usuarios');
    expect(compiled.textContent).toContain('Administración');
    expect(compiled.textContent).toContain('Roles');
    expect(compiled.querySelector('[data-testid="user-menu-trigger"]')).not.toBeNull();
    expect(compiled.textContent).not.toContain('Iniciar sesión');
  });

  it('switches the shared language between Spanish and English', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('app-language-switcher button'),
    );
    const english = buttons.find((button) => button.textContent?.trim() === 'EN');
    expect(english).toBeDefined();

    english?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Sign in');
  });
});

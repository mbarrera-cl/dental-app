import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { SessionStore } from 'auth';
import type { AuthSession } from 'data-access';
import { provideAppTransloco, provideSpartanHlm } from 'ui';
import { App } from './app';

const SESSION: AuthSession = {
  accessToken: 'token-1',
  expiresIn: 900,
  user: { id: 'user-1', email: 'admin@hexa.local', name: 'Admin', status: 'active' },
  roles: [{ id: 'role-1', name: 'admin' }],
  permissions: {
    fromRoles: ['users:read', 'dashboard:read', 'roles:read'],
    direct: [],
    effective: ['users:read', 'dashboard:read', 'roles:read'],
  },
};

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

  it('renders the shell chrome for anonymous visitors: public nav and sign-in link', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('header')).not.toBeNull();
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
    expect(compiled.querySelector('hlm-toaster')).not.toBeNull();
    expect(compiled.textContent).toContain('Pacientes');
    expect(compiled.textContent).toContain('Iniciar sesión');
    // Links of guarded sections stay hidden without permissions.
    expect(compiled.textContent).not.toContain('Usuarios');
    expect(compiled.textContent).not.toContain('Admin');
  });

  it('reveals the guarded navigation as soon as the session has the keys', async () => {
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
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Usuarios');
    expect(compiled.textContent).toContain('Dashboard');
    expect(compiled.textContent).toContain('Admin');
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

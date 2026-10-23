import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthSession } from 'data-access';
import { formatDateTime, provideAppTransloco, provideSpartanHlm } from 'ui';
import { LoginPage } from './login-page';

const LOGIN_URL = 'http://localhost:3000/auth/login';
const CHANGE_EXPIRED_URL = 'http://localhost:3000/auth/change-expired-password';

const BRANDING = {
  branding: {
    name: 'Clínica Los Andes',
    slogan: 'Odontología familiar',
    logoUrl: null,
    faviconUrl: null,
    colors: { primary: '#0284c7', accent: '#f59e0b', mode: 'light' },
    login: {
      heading: 'Entra a Los Andes',
      lead: 'Tu equipo y tus pacientes, en un solo lugar.',
      headline: 'Tu clínica, en orden.',
      body: 'Ficha, agenda y presupuestos conectados.',
      point1: 'Ficha clínica',
      point2: 'Agenda',
      point3: 'Acceso por rol',
    },
    version: 0,
  },
  etag: null,
};

const SESSION: AuthSession = {
  accessToken: 'token-1',
  expiresIn: 900,
  user: { id: 'user-1', email: 'ada@example.com', name: 'Ada Lovelace', status: 'active' },
  roles: [{ id: 'role-1', name: 'editor' }],
  permissions: { fromRoles: ['users:read'], direct: [], effective: ['users:read'] },
};

describe('LoginPage', () => {
  let http: HttpTestingController;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ returnUrl: '/users' }) } },
        },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAppTransloco(),
        provideSpartanHlm(),
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  function render(): ComponentFixture<LoginPage> {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();

    return fixture;
  }

  function native(fixture: ComponentFixture<LoginPage>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function setInput(fixture: ComponentFixture<LoginPage>, testId: string, value: string): void {
    const input = native(fixture).querySelector<HTMLInputElement>(`[data-testid="${testId}"]`);
    expect(input).not.toBeNull();
    input!.value = value;
    input!.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function click(fixture: ComponentFixture<LoginPage>, testId: string): void {
    native(fixture).querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!.click();
    fixture.detectChanges();
  }

  it('renders the login copy configured by the clinic', () => {
    localStorage.setItem('hexa.branding', JSON.stringify(BRANDING));

    const fixture = render();
    const text = native(fixture).textContent;

    expect(text).toContain('Entra a Los Andes');
    expect(text).toContain('Tu equipo y tus pacientes, en un solo lugar.');
    expect(text).toContain('Tu clínica, en orden.');
    expect(text).toContain('Ficha, agenda y presupuestos conectados.');
    expect(text).toContain('Ficha clínica');
    expect(text).toContain('Agenda');
    expect(text).toContain('Acceso por rol');
    expect(text).not.toContain('El día de tu clínica, en orden.');
  });

  it('falls back to the translated login copy when nothing is configured', () => {
    const fixture = render();
    const text = native(fixture).textContent;

    expect(text).toContain('Entra a tu clínica');
    expect(text).toContain('Tu ficha clínica, la agenda y los presupuestos, en un solo lugar.');
    expect(text).toContain('El día de tu clínica, en orden.');
  });

  it('signs in and honours the returnUrl query parameter', async () => {
    const fixture = render();
    setInput(fixture, 'login-email', 'ada@example.com');
    setInput(fixture, 'login-password', 'secret');
    click(fixture, 'login-submit');

    const request = http.expectOne(LOGIN_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'ada@example.com', password: 'secret' });
    request.flush(SESSION);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(navigateByUrl).toHaveBeenCalledWith('/users');
    expect(native(fixture).querySelector('[data-testid="login-error"]')).toBeNull();
  });

  it('toggles the password visibility without submitting', () => {
    const fixture = render();
    const input = native(fixture).querySelector<HTMLInputElement>('[data-testid="login-password"]');
    const toggle = input?.parentElement?.querySelector<HTMLButtonElement>('button[aria-pressed]');

    expect(input?.type).toBe('password');
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');

    toggle!.click();
    fixture.detectChanges();

    expect(input?.type).toBe('text');
    expect(toggle?.getAttribute('aria-pressed')).toBe('true');
    expect(http.match(LOGIN_URL).length).toBe(0);
  });

  it('shows an inline error for invalid credentials', async () => {
    const fixture = render();
    setInput(fixture, 'login-email', 'ada@example.com');
    setInput(fixture, 'login-password', 'wrong');
    click(fixture, 'login-submit');

    http
      .expectOne(LOGIN_URL)
      .flush(
        { statusCode: 401, error: 'InvalidCredentialsError', message: 'Invalid email or password' },
        { status: 401, statusText: 'Unauthorized' },
      );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(native(fixture).querySelector('[data-testid="login-error"]')?.textContent).toContain(
      'incorrectos',
    );
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('reports a locked account together with the unlock time', async () => {
    const fixture = render();
    setInput(fixture, 'login-email', 'ada@example.com');
    setInput(fixture, 'login-password', 'wrong');
    click(fixture, 'login-submit');

    http.expectOne(LOGIN_URL).flush(
      {
        statusCode: 423,
        error: 'AccountLockedError',
        message: 'locked',
        details: { lockedUntil: '2026-10-16T18:30:00.000Z' },
      },
      { status: 423, statusText: 'Locked' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    const lockedUntil = '2026-10-16T18:30:00.000Z';
    const error = native(fixture).querySelector('[data-testid="login-error"]')?.textContent;
    expect(error).toContain('bloqueada');
    expect(error).toContain(formatDateTime(lockedUntil, 'es'));
  });

  it('switches to the forced-change form when the password expired (and signs in after)', async () => {
    const fixture = render();
    setInput(fixture, 'login-email', 'ada@example.com');
    setInput(fixture, 'login-password', 'secret');
    click(fixture, 'login-submit');

    http.expectOne(LOGIN_URL).flush(
      {
        statusCode: 403,
        error: 'PasswordChangeRequiredError',
        message: 'must change',
        details: { reason: 'reset' },
      },
      { status: 403, statusText: 'Forbidden' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(native(fixture).querySelector('[data-testid="login-expired"]')).not.toBeNull();
    expect(native(fixture).textContent).toContain('restablecido');

    setInput(fixture, 'login-new-password', 'Nueva-1234!');
    setInput(fixture, 'login-confirm', 'Nueva-1234!');
    click(fixture, 'login-expired-submit');

    const request = http.expectOne(CHANGE_EXPIRED_URL);
    expect(request.request.body).toEqual({
      email: 'ada@example.com',
      currentPassword: 'secret',
      newPassword: 'Nueva-1234!',
    });
    request.flush({ ...SESSION, accessToken: 'token-2' });
    await fixture.whenStable();

    expect(navigateByUrl).toHaveBeenCalledWith('/users');
  });

  it('lists every password policy violation of a rejected new password', async () => {
    const fixture = render();
    setInput(fixture, 'login-email', 'ada@example.com');
    setInput(fixture, 'login-password', 'secret');
    click(fixture, 'login-submit');

    http.expectOne(LOGIN_URL).flush(
      {
        statusCode: 403,
        error: 'PasswordChangeRequiredError',
        message: 'must change',
        details: { reason: 'expired' },
      },
      { status: 403, statusText: 'Forbidden' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    setInput(fixture, 'login-new-password', 'abc');
    setInput(fixture, 'login-confirm', 'abc');
    click(fixture, 'login-expired-submit');

    http.expectOne(CHANGE_EXPIRED_URL).flush(
      {
        statusCode: 400,
        error: 'PasswordPolicyViolationError',
        message: 'policy',
        details: {
          violations: [
            { rule: 'minLength', message: 'must be at least 8 characters long' },
            { rule: 'uppercase', message: 'must contain an uppercase letter' },
          ],
        },
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    const violations = native(fixture).querySelector(
      '[data-testid="login-violations"]',
    )?.textContent;
    expect(violations).toContain('longitud mínima');
    expect(violations).toContain('mayúscula');
  });
});

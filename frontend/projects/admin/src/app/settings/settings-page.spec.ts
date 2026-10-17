import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { SessionStore } from 'auth';
import type { Setting, SettingsValues } from 'data-access';
import { provideAppTransloco, provideSpartanHlm } from 'ui';
import { SettingsPage } from './settings-page';

const BASE = 'http://localhost:3000';
const SETTINGS_URL = `${BASE}/settings`;

const SETTINGS: Setting[] = [
  {
    key: 'passwordPolicy.minLength',
    group: 'passwordPolicy',
    type: 'number',
    value: 12,
    default: 8,
    min: 6,
    max: 64,
    description: 'Minimum password length',
  },
  {
    key: 'passwordPolicy.requireDigit',
    group: 'passwordPolicy',
    type: 'boolean',
    value: true,
    default: true,
    description: 'Require at least one digit',
  },
  {
    key: 'session.refreshTokenTtlDays',
    group: 'session',
    type: 'number',
    value: 7,
    default: 7,
    min: 1,
    max: 365,
    description: 'Refresh token lifetime',
  },
];

/** Minimal callable-signal shape, so the spec can read and set page state. */
interface Signal<T> {
  (): T;
  set(value: T): void;
}

/** Protected members of the page, reachable from the spec (like api-keys-page.spec). */
interface PageHandle {
  draft: Signal<SettingsValues>;
  dirtyCount: Signal<number>;
  isDirty(setting: Setting): boolean;
  valueOf(setting: Setting): number | boolean | string;
  discard(): void;
}

describe('SettingsPage', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsPage],
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

  function render(settings: Setting[] = SETTINGS): ComponentFixture<SettingsPage> {
    const fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
    http.expectOne(SETTINGS_URL).flush(settings);
    fixture.detectChanges();

    return fixture;
  }

  function handle(fixture: ComponentFixture<SettingsPage>): PageHandle {
    return fixture.componentInstance as unknown as PageHandle;
  }

  function native(fixture: ComponentFixture<SettingsPage>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function click(fixture: ComponentFixture<SettingsPage>, testId: string): void {
    const button = native(fixture).querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
    expect(button).not.toBeNull();
    button!.click();
    fixture.detectChanges();
  }

  function input(fixture: ComponentFixture<SettingsPage>, key: string): HTMLInputElement {
    const element = native(fixture).querySelector<HTMLInputElement>(`[data-testid="setting-input-${key}"]`);
    expect(element).not.toBeNull();
    return element!;
  }

  it('renders the dynamic form grouped with translated labels', () => {
    const fixture = render();

    const groups = native(fixture).querySelectorAll('[data-testid="settings-group"]');
    expect(groups.length).toBe(2);
    expect(native(fixture).textContent).toContain('Política de contraseñas');
    expect(native(fixture).textContent).toContain('Longitud mínima');
    expect(native(fixture).textContent).toContain('Sesión');
    expect(input(fixture, 'passwordPolicy.minLength').value).toBe('12');
  });

  it('saves only the changed values and clears the draft', () => {
    const fixture = render();
    const page = handle(fixture);

    const length = input(fixture, 'passwordPolicy.minLength');
    length.value = '10';
    length.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(page.isDirty(SETTINGS[0])).toBe(true);
    expect(native(fixture).querySelector('[data-testid="settings-save-bar"]')).not.toBeNull();

    click(fixture, 'settings-save');

    const request = http.expectOne(SETTINGS_URL);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ values: { 'passwordPolicy.minLength': 10 } });
    request.flush(SETTINGS.map((setting) => (setting.key === 'passwordPolicy.minLength' ? { ...setting, value: 10 } : setting)));
    fixture.detectChanges();

    expect(page.dirtyCount()).toBe(0);
    expect(native(fixture).querySelector('[data-testid="settings-save-bar"]')).toBeNull();
  });

  it('uses the registry default and can discard a single change', () => {
    const fixture = render();
    const page = handle(fixture);

    click(fixture, 'setting-default-passwordPolicy.minLength');

    expect(page.draft()).toEqual({ 'passwordPolicy.minLength': 8 });
    expect(page.valueOf(SETTINGS[0])).toBe(8);

    click(fixture, 'setting-reset-passwordPolicy.minLength');

    expect(page.isDirty(SETTINGS[0])).toBe(false);
    expect(page.valueOf(SETTINGS[0])).toBe(12);
  });

  it('skips the clinic group, which has its own panel', () => {
    const fixture = render([
      ...SETTINGS,
      {
        key: 'clinic.name',
        group: 'clinic',
        type: 'string',
        value: 'Mi clínica',
        default: 'Mi clínica',
        maxLength: 60,
        description: 'Clinic display name',
      },
    ]);

    const groups = native(fixture).querySelectorAll('[data-testid="settings-group"]');
    expect(groups.length).toBe(2);
    expect(native(fixture).querySelector('[data-testid="setting-input-clinic.name"]')).toBeNull();
  });

  it('toggles boolean settings', () => {
    const fixture = render();
    const page = handle(fixture);

    const checkbox = input(fixture, 'passwordPolicy.requireDigit');
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(page.draft()).toEqual({ 'passwordPolicy.requireDigit': false });
  });

  it('discards every pending change at once', () => {
    const fixture = render();
    const page = handle(fixture);

    const length = input(fixture, 'passwordPolicy.minLength');
    length.value = '9';
    length.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(page.dirtyCount()).toBe(1);

    page.discard();
    fixture.detectChanges();

    expect(page.dirtyCount()).toBe(0);
  });
});

import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionStore } from 'auth';
import {
  REGIONS,
  type ClinicBranding,
  type Setting,
  type SettingValue,
  type SettingsAuditEntry,
} from 'data-access';
import { provideAppTransloco, provideSpartanHlm } from 'ui';
import { ClinicPage } from './clinic-page';
import { LogoImageService, type PreparedImage } from './logo-image.service';

const API = 'http://localhost:3000';
const BRANDING_URL = `${API}/clinic/branding`;
const AUDIT_URL = `${API}/settings/audit?limit=5`;
const STORAGE_KEY = 'hexa.branding';

const setting = (key: string, value: SettingValue, overrides: Partial<Setting> = {}): Setting => ({
  key,
  group: 'clinic',
  type: 'string',
  value,
  default: '',
  description: key,
  ...overrides,
});

const CLINIC_SETTINGS: Setting[] = [
  setting('clinic.name', 'Mi clínica', { maxLength: 60, default: 'Mi clínica' }),
  setting('clinic.slogan', 'Odontología familiar', { maxLength: 120 }),
  setting('clinic.login.heading', '', { maxLength: 120 }),
  setting('clinic.login.lead', '', { maxLength: 240 }),
  setting('clinic.login.headline', '', { maxLength: 120 }),
  setting('clinic.login.body', '', { maxLength: 320 }),
  setting('clinic.login.point1', '', { maxLength: 80 }),
  setting('clinic.login.point2', '', { maxLength: 80 }),
  setting('clinic.login.point3', '', { maxLength: 80 }),
  setting('clinic.timeZone', 'America/Santiago'),
  setting('clinic.legalName', ''),
  setting('clinic.rut', ''),
  setting('clinic.address.region', 'RM', {
    type: 'enum',
    values: REGIONS.map((region) => region.code),
  }),
  setting('clinic.address.comuna', 'Providencia'),
  setting('clinic.address.calle', 'Av. Providencia'),
  setting('clinic.address.numero', '1234'),
  setting('clinic.address.oficina', ''),
  setting('clinic.contact.phone', ''),
  setting('clinic.contact.email', ''),
  setting('clinic.contact.website', ''),
  setting('clinic.theme.primary', '#0284c7', { type: 'color' }),
  setting('clinic.theme.accent', '#f59e0b', { type: 'color' }),
  setting('clinic.theme.mode', 'light', { type: 'enum', values: ['auto', 'light'] }),
  setting('clinic.logo.version', 2, { type: 'number', managed: true }),
  setting('passwordPolicy.minLength', 12, { group: 'password', type: 'number' }),
];

const BRANDING: ClinicBranding = {
  name: 'Mi clínica',
  slogan: 'Odontología familiar',
  logoUrl: '/clinic/assets/logo?v=abc',
  faviconUrl: null,
  colors: { primary: '#0284c7', accent: '#f59e0b', mode: 'light' },
  version: 2,
};

const AUDIT_ENTRY: SettingsAuditEntry = {
  id: 'audit-1',
  at: '2026-10-16T12:00:00.000Z',
  actorId: 'user-1',
  actorType: 'user',
  actorEmail: 'admin@hexa.local',
  changes: [{ key: 'clinic.name', from: 'Mi clínica', to: 'Importada' }],
};

const LOGO_UPLOAD = {
  version: 3,
  variants: [
    {
      variant: 'logo',
      mime: 'image/webp',
      width: 512,
      height: 512,
      size: 1024,
      hash: 'deadbeef',
      url: '/clinic/assets/logo?v=deadbeef',
    },
  ],
};

interface SessionStub {
  has: (key: string) => boolean;
  hasAll: (...keys: string[]) => boolean;
  hasAny: (...keys: string[]) => boolean;
  isAuthenticated: () => boolean;
  status: () => string;
}

const sessionStub = (permissions: string[]): SessionStub => {
  const granted = new Set(permissions);

  return {
    has: (key) => granted.has(key),
    hasAll: (...keys) => keys.every((key) => granted.has(key)),
    hasAny: (...keys) => keys.some((key) => granted.has(key)),
    isAuthenticated: () => true,
    status: () => 'authenticated',
  };
};

describe('ClinicPage', () => {
  let http: HttpTestingController;
  let permissions: string[];
  let images: {
    prepare: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
    renderCrop: ReturnType<typeof vi.fn>;
    suggestColors: ReturnType<typeof vi.fn>;
  };
  const prepared: PreparedImage = {
    element: document.createElement('img'),
    width: 800,
    height: 400,
    objectUrl: 'blob:prepared',
  };

  beforeEach(async () => {
    localStorage.clear();
    permissions = ['settings:read', 'settings:update'];
    images = {
      prepare: vi.fn(async () => prepared),
      release: vi.fn(),
      renderCrop: vi.fn(async () => new File(['x'], 'logo.webp', { type: 'image/webp' })),
      suggestColors: vi.fn(() => []),
    };

    await TestBed.configureTestingModule({
      imports: [ClinicPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAppTransloco(),
        provideSpartanHlm(),
        { provide: SessionStore, useFactory: () => sessionStub(permissions) },
        { provide: LogoImageService, useValue: images },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  const render = async (
    settings: Setting[] = CLINIC_SETTINGS,
    audit: SettingsAuditEntry[] = [],
  ): Promise<ComponentFixture<ClinicPage>> => {
    const fixture = TestBed.createComponent(ClinicPage);

    fixture.detectChanges();
    http.expectOne(`${API}/settings`).flush(settings);
    http.expectOne(AUDIT_URL).flush(audit);
    await fixture.whenStable();
    fixture.detectChanges();

    return fixture;
  };

  const find = <T extends Element>(
    fixture: ComponentFixture<ClinicPage>,
    selector: string,
  ): T | null => {
    const root = fixture.nativeElement as HTMLElement;

    return root.querySelector<T>(selector) ?? document.body.querySelector<T>(selector);
  };

  const setInput = (fixture: ComponentFixture<ClinicPage>, testId: string, value: string): void => {
    const input = find<HTMLInputElement>(fixture, `[data-testid="${testId}"]`)!;

    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  it('prefills the form from the clinic settings and starts clean', async () => {
    const fixture = await render();

    expect(find<HTMLInputElement>(fixture, '[data-testid="clinic-name"]')!.value).toBe(
      'Mi clínica',
    );
    expect(find<HTMLInputElement>(fixture, '[data-testid="clinic-primary-hex"]')!.value).toBe(
      '#0284c7',
    );
    expect(find<HTMLSelectElement>(fixture, '#clinic-region')!.value).toBe('RM');
    expect(find<HTMLButtonElement>(fixture, '[data-testid="clinic-save"]')!.disabled).toBe(true);
    expect(find(fixture, '[data-testid="clinic-dirty"]')).toBeNull();
  });

  it('saves only the dirty keys and re-baselines with the response', async () => {
    const fixture = await render();

    setInput(fixture, 'clinic-name', 'Clínica Nueva');

    expect(find(fixture, '[data-testid="clinic-dirty"]')!.textContent).toContain('1');
    find<HTMLButtonElement>(fixture, '[data-testid="clinic-save"]')!.click();
    fixture.detectChanges();

    const request = http.expectOne(`${API}/settings`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ values: { 'clinic.name': 'Clínica Nueva' } });

    request.flush([
      setting('clinic.name', 'Clínica Nueva', { maxLength: 60, default: 'Mi clínica' }),
      ...CLINIC_SETTINGS.slice(1),
    ]);

    http.expectOne(BRANDING_URL).flush(BRANDING);
    http.expectOne(AUDIT_URL).flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(find(fixture, '[data-testid="clinic-dirty"]')).toBeNull();
    expect(find<HTMLButtonElement>(fixture, '[data-testid="clinic-save"]')!.disabled).toBe(true);
  });

  it('saves every login copy field', async () => {
    const fixture = await render();
    const copy = {
      'clinic.login.heading': 'Entra a tu espacio',
      'clinic.login.lead': 'Tu equipo y tus pacientes, en un solo lugar.',
      'clinic.login.headline': 'Tu clínica, en orden.',
      'clinic.login.body': 'Ficha, agenda y presupuestos conectados.',
      'clinic.login.point1': 'Ficha clínica',
      'clinic.login.point2': 'Agenda',
      'clinic.login.point3': 'Acceso por rol',
    };

    setInput(fixture, 'clinic-login-heading', copy['clinic.login.heading']);
    setInput(fixture, 'clinic-login-lead', copy['clinic.login.lead']);
    setInput(fixture, 'clinic-login-headline', copy['clinic.login.headline']);
    setInput(fixture, 'clinic-login-body', copy['clinic.login.body']);
    setInput(fixture, 'clinic-login-point1', copy['clinic.login.point1']);
    setInput(fixture, 'clinic-login-point2', copy['clinic.login.point2']);
    setInput(fixture, 'clinic-login-point3', copy['clinic.login.point3']);

    expect(find(fixture, '[data-testid="clinic-dirty"]')!.textContent).toContain('7');

    find<HTMLButtonElement>(fixture, '[data-testid="clinic-save"]')!.click();
    fixture.detectChanges();

    const request = http.expectOne(`${API}/settings`);
    expect(request.request.body).toEqual({ values: copy });

    request.flush(
      CLINIC_SETTINGS.map((entry) =>
        entry.key in copy ? { ...entry, value: copy[entry.key as keyof typeof copy] } : entry,
      ),
    );
    http.expectOne(BRANDING_URL).flush(BRANDING);
    http.expectOne(AUDIT_URL).flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    for (const [key, value] of Object.entries(copy)) {
      const control = key.replace('clinic.login.', 'clinic-login-');
      expect(find<HTMLInputElement>(fixture, `[data-testid="${control}"]`)!.value).toBe(value);
    }
    expect(find(fixture, '[data-testid="clinic-dirty"]')).toBeNull();
  });

  it('discards pending changes back to the baseline', async () => {
    const fixture = await render();

    setInput(fixture, 'clinic-name', 'Otra clínica');
    find<HTMLButtonElement>(fixture, '[data-testid="clinic-discard"]')!.click();
    fixture.detectChanges();

    expect(find<HTMLInputElement>(fixture, '[data-testid="clinic-name"]')!.value).toBe(
      'Mi clínica',
    );
    expect(find(fixture, '[data-testid="clinic-dirty"]')).toBeNull();
  });

  it('shows the WCAG chip for the seeds and blocks invalid hex', async () => {
    const fixture = await render();

    setInput(fixture, 'clinic-primary-hex', '#0f172a');

    expect(find(fixture, '[data-testid="clinic-primary-contrast"]')!.textContent).toContain('AAA');

    setInput(fixture, 'clinic-primary-hex', 'not-a-color');

    expect(find(fixture, '[data-testid="clinic-primary-contrast"]')).toBeNull();
    expect(find<HTMLButtonElement>(fixture, '[data-testid="clinic-save"]')!.disabled).toBe(true);
  });

  it('applies a theme preset to both seeds', async () => {
    const fixture = await render();

    find<HTMLButtonElement>(fixture, '[data-testid="theme-preset-berry"]')!.click();
    fixture.detectChanges();

    expect(find<HTMLInputElement>(fixture, '[data-testid="clinic-primary-hex"]')!.value).toBe(
      '#be185d',
    );
    expect(find<HTMLInputElement>(fixture, '[data-testid="clinic-accent-hex"]')!.value).toBe(
      '#7c3aed',
    );
    expect(find(fixture, '[data-testid="clinic-dirty"]')!.textContent).toContain('2');
  });

  it('crops and uploads a picked logo, then refreshes the branding', async () => {
    const fixture = await render();
    const file = new File(['fake'], 'logo.png', { type: 'image/png' });
    const input = find<HTMLInputElement>(fixture, '[data-testid="clinic-logo-input"]')!;

    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(images.prepare).toHaveBeenCalledWith(file);
    expect(find(fixture, '[data-testid="clinic-crop-dialog"]')).not.toBeNull();

    find<HTMLButtonElement>(fixture, '[data-testid="crop-apply"]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(images.renderCrop).toHaveBeenCalledWith(
      prepared,
      expect.objectContaining({ width: 400, height: 400 }),
    );

    const upload = http.expectOne(`${API}/clinic/logo`);
    expect(upload.request.method).toBe('POST');
    expect(upload.request.body).toBeInstanceOf(FormData);
    expect((upload.request.body as FormData).get('file')).toBeInstanceOf(File);

    upload.event({ type: HttpEventType.UploadProgress, loaded: 50, total: 100 });
    fixture.detectChanges();
    expect(find(fixture, '[data-testid="clinic-logo-progress"]')).not.toBeNull();

    upload.flush(LOGO_UPLOAD, { status: 201, statusText: 'Created' });

    http
      .expectOne(BRANDING_URL)
      .flush({ ...BRANDING, logoUrl: '/clinic/assets/logo?v=deadbeef', version: 3 });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(find(fixture, '[data-testid="clinic-crop-dialog"]')).toBeNull();
    const logo = find<HTMLImageElement>(fixture, '[data-testid="clinic-logo-current"]')!;
    expect(logo.getAttribute('src')).toBe(`${API}/clinic/assets/logo?v=deadbeef`);
  });

  it('removes the logo through the confirmation dialog', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ branding: BRANDING, etag: '"v1"' }));
    const fixture = await render();

    expect(find(fixture, '[data-testid="clinic-logo-current"]')).not.toBeNull();

    find<HTMLButtonElement>(fixture, '[data-testid="clinic-logo-remove"]')!.click();
    fixture.detectChanges();

    const confirm = find<HTMLButtonElement>(fixture, '[data-testid="clinic-logo-remove-confirm"]')!;
    expect(confirm).not.toBeNull();
    confirm.click();
    fixture.detectChanges();

    const request = http.expectOne(`${API}/clinic/logo`);
    expect(request.request.method).toBe('DELETE');
    request.flush({ version: 0 });

    http
      .expectOne(BRANDING_URL)
      .flush({ ...BRANDING, logoUrl: null, faviconUrl: null, version: 0 });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(find(fixture, '[data-testid="clinic-logo-current"]')).toBeNull();
  });

  it('exports the configuration envelope as a download', async () => {
    const fixture = await render();

    find<HTMLButtonElement>(fixture, '[data-testid="clinic-export"]')!.click();
    fixture.detectChanges();

    const request = http.expectOne(`${API}/settings/export`);
    expect(request.request.method).toBe('GET');
    request.flush({
      app: 'hexa',
      version: 1,
      exportedAt: '2026-10-16T12:00:00.000Z',
      values: { 'clinic.name': 'Mi clínica' },
    });
    await fixture.whenStable();
    fixture.detectChanges();

    // The blob download itself is best-effort; the request is the contract.
    expect(find<HTMLButtonElement>(fixture, '[data-testid="clinic-export"]')!.disabled).toBe(false);
  });

  it('imports a JSON file through the API, re-baselines and shows the trail entry', async () => {
    const fixture = await render();
    const input = find<HTMLInputElement>(fixture, '[data-testid="clinic-import-input"]')!;
    const file = new File(
      [JSON.stringify({ values: { 'clinic.name': 'Importada' } })],
      'hexa-settings.json',
      { type: 'application/json' },
    );

    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    const request = http.expectOne(`${API}/settings/import`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ values: { 'clinic.name': 'Importada' } });
    request.flush([
      setting('clinic.name', 'Importada', { maxLength: 60, default: 'Mi clínica' }),
      ...CLINIC_SETTINGS.slice(1),
    ]);

    http.expectOne(AUDIT_URL).flush([AUDIT_ENTRY]);
    http.expectOne(BRANDING_URL).flush({ ...BRANDING, name: 'Importada' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(find<HTMLInputElement>(fixture, '[data-testid="clinic-name"]')!.value).toBe('Importada');
    expect(find(fixture, '[data-testid="clinic-dirty"]')).toBeNull();
    expect(find(fixture, '[data-testid="clinic-audit-entry"]')!.textContent).toContain(
      'admin@hexa.local',
    );
  });

  it('rejects a pick that is not a configuration export', async () => {
    const fixture = await render();
    const input = find<HTMLInputElement>(fixture, '[data-testid="clinic-import-input"]')!;
    const file = new File(['not json'], 'random.json', { type: 'application/json' });

    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();

    // No import request goes out; the toast explains why.
    http.expectNone(`${API}/settings/import`);
    expect(find(fixture, '[data-testid="clinic-audit-entry"]')).toBeNull();
  });

  it('renders the change history with the actor and the diff', async () => {
    const fixture = await render(CLINIC_SETTINGS, [AUDIT_ENTRY]);
    const entry = find(fixture, '[data-testid="clinic-audit-entry"]')!;

    expect(entry.textContent).toContain('admin@hexa.local');
    expect(entry.textContent).toContain('clinic.name');
    expect(entry.textContent).toContain('Mi clínica → Importada');
    expect(find(fixture, '[data-testid="clinic-audit-empty"]')).toBeNull();
  });

  it('is read-only without settings:update', async () => {
    permissions = ['settings:read'];

    const fixture = await render();

    expect(find(fixture, '[data-testid="clinic-readonly"]')).not.toBeNull();
    expect(find(fixture, '[data-testid="clinic-save"]')).toBeNull();
    expect(find(fixture, '[data-testid="clinic-logo-dropzone"]')).toBeNull();
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL, type ClinicBranding } from 'data-access';
import { ThemeService } from 'ui';
import { BrandingStore } from './branding-store';

const BASE_URL = 'http://api.test';
const BRANDING_URL = `${BASE_URL}/clinic/branding`;
const STORAGE_KEY = 'hexa.branding';

const BRANDING: ClinicBranding = {
  name: 'Mi clínica',
  slogan: 'Odontología familiar',
  logoUrl: '/clinic/assets/logo?v=abc',
  faviconUrl: '/clinic/assets/favicon?v=def',
  colors: { primary: '#0284c7', accent: '#f59e0b', mode: 'auto' },
  version: 1,
};

describe('BrandingStore', () => {
  let http: HttpTestingController;
  let theme: { apply: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    localStorage.clear();
    theme = { apply: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE_URL },
        { provide: ThemeService, useValue: theme },
      ],
    });

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('paints synchronously from the localStorage cache, with absolute asset URLs', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ branding: BRANDING, etag: '"v1"' }));

    const store = TestBed.inject(BrandingStore);

    expect(store.name()).toBe('Mi clínica');
    expect(store.slogan()).toBe('Odontología familiar');
    expect(store.logoUrl()).toBe(`${BASE_URL}/clinic/assets/logo?v=abc`);
    expect(store.faviconUrl()).toBe(`${BASE_URL}/clinic/assets/favicon?v=def`);
    expect(theme.apply).toHaveBeenCalledWith({
      primary: '#0284c7',
      accent: '#f59e0b',
      mode: 'auto',
      name: 'Mi clínica',
      faviconUrl: `${BASE_URL}/clinic/assets/favicon?v=def`,
    });
  });

  it('starts unbranded (null signals) when there is no cache', () => {
    const store = TestBed.inject(BrandingStore);

    expect(store.name()).toBeNull();
    expect(store.slogan()).toBeNull();
    expect(store.logoUrl()).toBeNull();
    expect(theme.apply).not.toHaveBeenCalled();
  });

  it('revalidates with the cached ETag and repaints on 200', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ branding: BRANDING, etag: '"v1"' }));
    const store = TestBed.inject(BrandingStore);
    let completed = false;

    store.refresh().subscribe(() => {
      completed = true;
    });

    const request = http.expectOne(BRANDING_URL);
    expect(request.request.headers.get('If-None-Match')).toBe('"v1"');
    request.flush(
      { ...BRANDING, name: 'Clínica Los Andes', version: 2 },
      { headers: { ETag: '"v2"' } },
    );

    expect(completed).toBe(true);
    expect(store.name()).toBe('Clínica Los Andes');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({
      branding: { ...BRANDING, name: 'Clínica Los Andes', version: 2 },
      etag: '"v2"',
    });
  });

  it('keeps the cached paint on 304', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ branding: BRANDING, etag: '"v1"' }));
    const store = TestBed.inject(BrandingStore);
    const paints = theme.apply.mock.calls.length;

    store.refresh().subscribe();

    http
      .expectOne(BRANDING_URL)
      .flush(null, { status: 304, statusText: 'Not Modified' });

    expect(store.name()).toBe('Mi clínica');
    expect(theme.apply).toHaveBeenCalledTimes(paints);
  });

  it('resolves and keeps the cache when the API is unreachable', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ branding: BRANDING, etag: '"v1"' }));
    const store = TestBed.inject(BrandingStore);
    let completed = false;

    store.refresh().subscribe(() => {
      completed = true;
    });

    http.expectOne(BRANDING_URL).error(new ProgressEvent('error'));

    expect(completed).toBe(true);
    expect(store.name()).toBe('Mi clínica');
  });

  it('applies a fresh branding after the panel saves (and caches it)', () => {
    const store = TestBed.inject(BrandingStore);

    store.apply({ ...BRANDING, name: 'Clínica Nueva', logoUrl: null }, '"v9"');

    expect(store.name()).toBe('Clínica Nueva');
    expect(store.logoUrl()).toBeNull();
    expect(theme.apply).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: 'Clínica Nueva', faviconUrl: `${BASE_URL}/clinic/assets/favicon?v=def` }),
    );
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({
      branding: { ...BRANDING, name: 'Clínica Nueva', logoUrl: null },
      etag: '"v9"',
    });
  });

  it('ignores a corrupted cache instead of failing boot', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');

    const store = TestBed.inject(BrandingStore);

    expect(store.name()).toBeNull();
  });
});

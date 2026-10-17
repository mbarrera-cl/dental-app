import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from './api-base-url';
import { assetUrl, BrandingApi } from './branding-api';
import type { BrandingSnapshot, ClinicBranding, LogoUploadProgress } from './branding.model';

const BASE_URL = 'http://api.test/v1/';

const BRANDING: ClinicBranding = {
  name: 'Mi clínica',
  slogan: '',
  logoUrl: '/clinic/assets/logo?v=abc',
  faviconUrl: '/clinic/assets/favicon?v=def',
  colors: { primary: '#0284c7', accent: '#f59e0b', mode: 'auto' },
  version: 2,
};

describe('BrandingApi', () => {
  let api: BrandingApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE_URL },
      ],
    });

    api = TestBed.inject(BrandingApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('gets the public branding and captures its ETag', () => {
    let snapshot: BrandingSnapshot | undefined;
    api.get().subscribe((value) => {
      snapshot = value;
    });

    const request = http.expectOne(`${BASE_URL}clinic/branding`);
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.has('If-None-Match')).toBe(false);

    request.flush(BRANDING, { headers: { ETag: '"v1"' } });

    expect(snapshot).toEqual({ branding: BRANDING, etag: '"v1"' });
  });

  it('revalidates with If-None-Match and keeps the cache on 304', () => {
    let snapshot: BrandingSnapshot | undefined;
    api.get('"v1"').subscribe((value) => {
      snapshot = value;
    });

    const request = http.expectOne(`${BASE_URL}clinic/branding`);
    expect(request.request.headers.get('If-None-Match')).toBe('"v1"');

    request.flush(null, { status: 304, statusText: 'Not Modified' });

    expect(snapshot).toEqual({ branding: null, etag: '"v1"' });
  });

  it('treats an empty 304 success like a not-modified answer too', () => {
    let snapshot: BrandingSnapshot | undefined;
    api.get('"v1"').subscribe((value) => {
      snapshot = value;
    });

    http.expectOne(`${BASE_URL}clinic/branding`).flush(null, { status: 304, statusText: 'Not Modified' });

    expect(snapshot).toEqual({ branding: null, etag: '"v1"' });
  });

  it('reports multipart progress and the response at 100 %', () => {
    const emissions: LogoUploadProgress[] = [];
    const file = new File(['bytes'], 'logo.png', { type: 'image/png' });

    api.upload(file).subscribe((value) => {
      emissions.push(value);
    });

    const request = http.expectOne(`${BASE_URL}clinic/logo`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeInstanceOf(FormData);
    expect((request.request.body as FormData).get('file')).toBe(file);

    request.event({ type: 1, loaded: 50, total: 200 }); // HttpEventType.UploadProgress
    request.flush({ version: 3, variants: [] }, { status: 201, statusText: 'Created' });

    expect(emissions).toEqual([
      { progress: 25 },
      { progress: 100, upload: { version: 3, variants: [] } },
    ]);
  });

  it('removes the logo and returns the version left active', () => {
    let removal: unknown;
    api.remove().subscribe((value) => {
      removal = value;
    });

    const request = http.expectOne(`${BASE_URL}clinic/logo`);
    expect(request.request.method).toBe('DELETE');

    request.flush({ version: 0 });

    expect(removal).toEqual({ version: 0 });
  });
});

describe('assetUrl', () => {
  it('builds an absolute URL and normalizes trailing slashes', () => {
    expect(assetUrl('http://api.test/v1/', 'logo')).toBe('http://api.test/v1/clinic/assets/logo');
    expect(assetUrl('http://api.test/v1///', 'logo', 'abc123')).toBe(
      'http://api.test/v1/clinic/assets/logo?v=abc123',
    );
  });

  it('omits the query when there is no hash', () => {
    expect(assetUrl('http://api.test', 'favicon', null)).toBe(
      'http://api.test/clinic/assets/favicon',
    );
  });
});

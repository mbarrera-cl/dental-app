import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildThemePalette } from './theme-palette';
import { ThemeService, type ThemeBranding } from './theme.service';

interface MediaQueryStub {
  matches: boolean;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
  listeners: (() => void)[];
}

const stubMatchMedia = (matches: boolean): MediaQueryStub => {
  const stub: MediaQueryStub = {
    matches,
    listeners: [],
    addEventListener: (_type, listener) => {
      stub.listeners.push(listener);
    },
    removeEventListener: (_type, listener) => {
      stub.listeners = stub.listeners.filter((candidate) => candidate !== listener);
    },
  };

  vi.stubGlobal('matchMedia', vi.fn(() => stub));

  return stub;
};

const BRANDING: ThemeBranding = {
  primary: '#0284c7',
  accent: '#f59e0b',
  mode: 'light',
  name: 'Clínica Los Andes',
  faviconUrl: 'http://api.test/clinic/assets/favicon?v=abc',
};

/** Deterministic `URL.createObjectURL` — jsdom does not implement Blob URLs. */
const stubObjectUrls = (): { blobs: Blob[]; revoked: string[] } => {
  const blobs: Blob[] = [];
  const revoked: string[] = [];

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: (blob: Blob) => {
      blobs.push(blob);

      return `blob:hexa-manifest-${blobs.length}`;
    },
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: (url: string) => {
      revoked.push(url);
    },
  });

  return { blobs, revoked };
};

const readBlob = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });

const palette = buildThemePalette({ primary: '#0284c7', accent: '#f59e0b' });

describe('ThemeService', () => {
  let service: ThemeService;
  let objectUrls: { blobs: Blob[]; revoked: string[] };

  beforeEach(() => {
    stubMatchMedia(false);
    objectUrls = stubObjectUrls();
    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    document.documentElement.removeAttribute('style');
    document.documentElement.classList.remove('dark');
    document.head.querySelector('link[rel="icon"]')?.remove();
    document.head.querySelector('link[rel="manifest"]')?.remove();
    document.head.querySelector('meta[name="theme-color"]')?.remove();
    document.title = '';
    Reflect.deleteProperty(URL, 'createObjectURL');
    Reflect.deleteProperty(URL, 'revokeObjectURL');
    vi.unstubAllGlobals();
  });

  it('sets the brand tokens, title, favicon and theme-color', () => {
    service.apply(BRANDING);

    const root = document.documentElement;
    expect(root.style.getPropertyValue('--primary')).toBe(palette.light['--primary']);
    expect(root.style.getPropertyValue('--primary-foreground')).toBe(
      palette.light['--primary-foreground'],
    );
    expect(root.classList.contains('dark')).toBe(false);
    expect(document.title).toBe('Clínica Los Andes');

    const icon = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
    expect(icon?.getAttribute('href')).toBe('http://api.test/clinic/assets/favicon?v=abc');
    expect(icon?.type).toBe('image/png');

    const themeColor = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    expect(themeColor?.content).toBe('#0284c7');
  });

  it('falls back to the shipped favicon when the clinic has no logo', () => {
    service.apply({ ...BRANDING, faviconUrl: null });

    const icon = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
    expect(icon?.getAttribute('href')).toBe('favicon.ico');
    expect(icon?.type).toBe('image/x-icon');
  });

  it('follows the system scheme in auto mode and reacts to changes', () => {
    const media = stubMatchMedia(false);
    // A fresh instance captures the new stub.
    TestBed.resetTestingModule();
    const auto = TestBed.inject(ThemeService);
    auto.apply({ ...BRANDING, mode: 'auto' });

    expect(document.documentElement.style.getPropertyValue('--primary')).toBe(
      palette.light['--primary'],
    );
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    media.matches = true;
    for (const listener of media.listeners) {
      listener();
    }

    expect(document.documentElement.style.getPropertyValue('--primary')).toBe(
      palette.dark['--primary'],
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('keeps the light scheme when the mode forces it, even on a dark system', () => {
    stubMatchMedia(true);
    TestBed.resetTestingModule();
    const forced = TestBed.inject(ThemeService);
    forced.apply({ ...BRANDING, mode: 'light' });

    expect(document.documentElement.style.getPropertyValue('--primary')).toBe(
      palette.light['--primary'],
    );
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('removes every override when applied null', () => {
    service.apply(BRANDING);
    service.apply(null);

    const root = document.documentElement;
    expect(root.style.getPropertyValue('--primary')).toBe('');
    expect(root.style.getPropertyValue('--sidebar-primary')).toBe('');
    expect(root.classList.contains('dark')).toBe(false);
  });

  it('publishes a dynamic web manifest with the clinic name, color and logo', async () => {
    service.apply({ ...BRANDING, logoUrl: 'http://api.test/clinic/assets/logo?v=abc' });

    const link = document.head.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    expect(link?.getAttribute('href')).toBe('blob:hexa-manifest-1');

    const manifest = JSON.parse(await readBlob(objectUrls.blobs[0]!)) as {
      name: string;
      short_name: string;
      theme_color: string;
      icons: Array<{ src: string }>;
    };

    expect(manifest).toMatchObject({
      name: 'Clínica Los Andes',
      short_name: 'Clínica Los Andes',
      theme_color: '#0284c7',
      icons: [{ src: 'http://api.test/clinic/assets/logo?v=abc' }],
    });
  });

  it('falls back to the i18n-free name without icon, and revokes the old URL', async () => {
    service.apply({ primary: '#0284c7', accent: '#f59e0b', mode: 'light' });
    service.apply({ ...BRANDING, logoUrl: null });

    expect(objectUrls.revoked).toEqual(['blob:hexa-manifest-1']);

    const first = JSON.parse(await readBlob(objectUrls.blobs[0]!)) as {
      name: string;
      icons?: unknown;
    };
    expect(first.name).toBe('Hexa');
    expect(first.icons).toBeUndefined();

    const second = JSON.parse(await readBlob(objectUrls.blobs[1]!)) as {
      name: string;
      icons: Array<{ src: string }>;
    };
    expect(second.name).toBe('Clínica Los Andes');
    expect(second.icons).toEqual([
      {
        src: 'http://api.test/clinic/assets/favicon?v=abc',
        sizes: 'any',
        type: 'image/png',
      },
    ]);
  });

  it('keeps the static manifest when the environment cannot build blob URLs', () => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    service.apply(BRANDING);

    expect(document.head.querySelector('link[rel="manifest"]')).toBeNull();
  });
});

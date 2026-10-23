import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { buildThemePalette, type ThemeSeeds } from './theme-palette';

/** Seeds plus the identity bits the document needs. */
export interface ThemeBranding extends ThemeSeeds {
  /** `light` forces the light scheme; anything else follows the system. */
  readonly mode: string;
  readonly name?: string | null;
  readonly faviconUrl?: string | null;
  /** Logo URL used as the (dynamic) web manifest icon. */
  readonly logoUrl?: string | null;
}

const DEFAULT_FAVICON = 'favicon.svg';

/**
 * Applies the clinic theme to the document: brand tokens as CSS custom
 * properties on `:root`, `document.title`, the dynamic favicon,
 * `meta[theme-color]` and a web manifest with the clinic name and logo. With
 * `mode: auto` the dark tokens follow the operating system and are re-applied
 * when it flips. `apply(null)` removes every override, falling back to the
 * static theme shipped in `theme.css`.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly schemeQuery: MediaQueryList | null;
  private current: ThemeBranding | null = null;
  private appliedTokens: readonly string[] = [];
  /** Object URL of the last dynamic manifest, revoked on replacement. */
  private manifestUrl: string | null = null;

  constructor() {
    const view = this.document.defaultView;
    this.schemeQuery = view?.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
    this.schemeQuery?.addEventListener('change', this.onSchemeChange);
  }

  private readonly onSchemeChange = (): void => {
    if (this.current !== null) {
      this.applyTokens(this.current);
    }
  };

  apply(branding: ThemeBranding | null): void {
    this.current = branding;

    if (branding === null) {
      this.clearOverrides();
      return;
    }

    this.applyTokens(branding);
    this.applyIdentity(branding);
  }

  private applyTokens(branding: ThemeBranding): void {
    const palette = buildThemePalette({ primary: branding.primary, accent: branding.accent });
    const dark = branding.mode !== 'light' && this.schemeQuery?.matches === true;
    const tokens = dark ? palette.dark : palette.light;
    const root = this.document.documentElement;

    for (const [token, value] of Object.entries(tokens)) {
      root.style.setProperty(token, value);
    }

    // `theme.css` ships a `.dark` block for the neutral surfaces; the brand
    // tokens are re-set inline above, so both stay in sync.
    root.classList.toggle('dark', dark);
    this.appliedTokens = Object.keys(tokens);
  }

  private applyIdentity(branding: ThemeBranding): void {
    if (branding.name !== undefined && branding.name !== null && branding.name !== '') {
      this.document.title = branding.name;
    }

    this.applyFavicon(branding.faviconUrl ?? null);
    this.applyThemeColor(branding.primary);
    this.applyManifest(branding);
  }

  /**
   * Replaces `link[rel="manifest"]` with a blob manifest carrying the clinic
   * name, color and icon, so "add to home screen" installs the clinic's face.
   * Environments without `URL.createObjectURL` (jsdom, older browsers) keep
   * the static manifest untouched.
   */
  private applyManifest(branding: ThemeBranding): void {
    const view = this.document.defaultView;
    const createObjectUrl = view?.URL?.createObjectURL;

    if (view === null || typeof createObjectUrl !== 'function') {
      return;
    }

    const name =
      branding.name !== undefined && branding.name !== null && branding.name !== ''
        ? branding.name
        : 'Clínica';
    const icon = branding.logoUrl ?? branding.faviconUrl ?? null;
    const manifest = {
      name,
      short_name: name,
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: branding.primary,
      ...(icon === null ? {} : { icons: [{ src: icon, sizes: 'any', type: 'image/png' }] }),
    };
    const url = this.safeCreateObjectUrl(
      view.URL,
      createObjectUrl,
      new Blob([JSON.stringify(manifest)], {
        type: 'application/manifest+json',
      }),
    );

    if (url === null) {
      return;
    }

    const link = this.ensureHeadElement<HTMLLinkElement>(
      'link[rel="manifest"]',
      'link',
      (element) => {
        element.rel = 'manifest';
      },
    );

    link.href = url;

    if (this.manifestUrl !== null) {
      view.URL.revokeObjectURL(this.manifestUrl);
    }

    this.manifestUrl = url;
  }

  /**
   * Blob URLs are best-effort: test environments may ship a `createObjectURL`
   * that rejects the runtime's own `Blob`, and the app must not care.
   */
  private safeCreateObjectUrl(
    urlApi: typeof URL,
    createObjectUrl: (blob: Blob) => string,
    blob: Blob,
  ): string | null {
    try {
      return createObjectUrl.call(urlApi, blob);
    } catch {
      return null;
    }
  }

  private applyFavicon(url: string | null): void {
    const link = this.ensureHeadElement<HTMLLinkElement>('link[rel="icon"]', 'link', (element) => {
      element.rel = 'icon';
    });

    link.href = url ?? DEFAULT_FAVICON;
    link.type = url === null ? 'image/svg+xml' : 'image/png';
  }

  private applyThemeColor(primary: string): void {
    const meta = this.ensureHeadElement<HTMLMetaElement>(
      'meta[name="theme-color"]',
      'meta',
      (element) => {
        element.name = 'theme-color';
      },
    );

    meta.content = primary;
  }

  private clearOverrides(): void {
    const root = this.document.documentElement;

    for (const token of this.appliedTokens) {
      root.style.removeProperty(token);
    }

    this.appliedTokens = [];
    root.classList.remove('dark');
  }

  private ensureHeadElement<T extends HTMLElement>(
    selector: string,
    tag: string,
    decorate: (element: T) => void,
  ): T {
    const existing = this.document.head.querySelector<T>(selector);

    if (existing !== null) {
      return existing;
    }

    const element = this.document.createElement(tag) as T;
    decorate(element);
    this.document.head.appendChild(element);

    return element;
  }
}

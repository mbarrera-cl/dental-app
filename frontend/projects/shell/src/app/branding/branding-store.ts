import { computed, inject, Injectable, signal } from '@angular/core';
import { API_BASE_URL, BrandingApi, type ClinicBranding } from 'data-access';
import { catchError, map, of, tap, type Observable } from 'rxjs';
import { ThemeService } from 'ui';

const STORAGE_KEY = 'hexa.branding';

interface CachedBranding {
  branding: ClinicBranding;
  etag: string | null;
}

/**
 * Clinic branding as signals. Paints first from `localStorage` — no flash of
 * unbranded chrome — and then revalidates against `GET /clinic/branding` with
 * the stored ETag: a 304 means the cached paint was already right and nothing
 * is repainted.
 */
@Injectable({ providedIn: 'root' })
export class BrandingStore {
  private readonly api = inject(BrandingApi);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly theme = inject(ThemeService);
  private readonly brandingSignal = signal<ClinicBranding | null>(null);
  private readonly etagSignal = signal<string | null>(null);

  readonly branding = this.brandingSignal.asReadonly();
  /** Clinic name, or null while unknown (templates fall back to i18n). */
  readonly name = computed(() => this.brandingSignal()?.name ?? null);
  readonly slogan = computed(() => {
    const slogan = this.brandingSignal()?.slogan ?? '';

    return slogan === '' ? null : slogan;
  });
  /** Absolute logo URL for `[src]` bindings; null when there is no logo. */
  readonly logoUrl = computed(() => this.absolute(this.brandingSignal()?.logoUrl));
  readonly faviconUrl = computed(() => this.absolute(this.brandingSignal()?.faviconUrl));
  /** Configured login panel copy; null falls back to the localized strings. */
  readonly login = computed(() => this.brandingSignal()?.login ?? null);

  constructor() {
    const cached = this.readCache();

    if (cached !== null) {
      this.apply(cached.branding, cached.etag);
    }
  }

  /** Called from `provideAppInitializer`, after `SessionStore.bootstrap()`. */
  refresh(): Observable<void> {
    return this.api.get(this.etagSignal()).pipe(
      tap((snapshot) => {
        if (snapshot.branding !== null) {
          this.apply(snapshot.branding, snapshot.etag);
        }
      }),
      map(() => undefined),
      // API down or offline: keep the cached paint instead of failing boot.
      catchError(() => of(undefined)),
    );
  }

  /**
   * Applies a fresh branding: signals, cache and document (tokens, title,
   * favicon). The clinic panel calls it again right after saving.
   */
  apply(branding: ClinicBranding, etag: string | null = null): void {
    this.brandingSignal.set(branding);
    this.etagSignal.set(etag);
    this.writeCache({ branding, etag });

    this.theme.apply({
      primary: branding.colors.primary,
      accent: branding.colors.accent,
      mode: branding.colors.mode,
      name: branding.name,
      faviconUrl: this.absolute(branding.faviconUrl),
      logoUrl: this.absolute(branding.logoUrl),
    });
  }

  private absolute(url: string | null | undefined): string | null {
    if (url === null || url === undefined) {
      return null;
    }

    if (/^https?:\/\//.test(url)) {
      return url;
    }

    return `${this.baseUrl.replace(/\/+$/, '')}${url}`;
  }

  private readCache(): CachedBranding | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (raw === null) {
        return null;
      }

      const parsed = JSON.parse(raw) as Partial<CachedBranding>;
      const branding = parsed.branding;

      if (
        branding === undefined ||
        typeof branding.name !== 'string' ||
        typeof branding.colors?.primary !== 'string'
      ) {
        return null;
      }

      return { branding, etag: typeof parsed.etag === 'string' ? parsed.etag : null };
    } catch {
      return null;
    }
  }

  private writeCache(cached: CachedBranding): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
    } catch {
      // Unavailable storage (private mode, quota): the app still works, it
      // just paints unbranded until the API answers.
    }
  }
}

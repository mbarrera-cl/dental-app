import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { API_BASE_URL } from './api-base-url';
import { DEFAULT_PAGE_SIZE } from './pagination';
import type { UiSettings } from './ui-settings.model';

/**
 * Interface defaults shared by every list. The endpoint needs no
 * `settings:read`, so pagination keeps working for users who cannot open the
 * configuration panel.
 *
 * `load()` is lazy and idempotent: pages call it on init, the first successful
 * response wins and every other consumer reads the signal.
 */
@Injectable({ providedIn: 'root' })
export class UiSettingsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL).replace(/\/+$/, '');
  private readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  private requested = false;

  /** Page size configured by the admin (10 by default, 5–100). */
  readonly defaultPageSize = this.pageSize.asReadonly();

  load(): void {
    if (this.requested) {
      return;
    }

    this.requested = true;
    this.http.get<UiSettings>(`${this.baseUrl}/settings/ui`).subscribe({
      next: (settings) => {
        if (Number.isFinite(settings.defaultPageSize) && settings.defaultPageSize >= 1) {
          this.pageSize.set(Math.min(100, Math.trunc(settings.defaultPageSize)));
        }
      },
      // Keep the fallback and let the next page try again.
      error: () => {
        this.requested = false;
      },
    });
  }

  /** Exposed so tests can control the cached value without HTTP. */
  setDefaultPageSize(size: number): void {
    this.pageSize.set(Math.max(1, Math.trunc(size)));
  }
}

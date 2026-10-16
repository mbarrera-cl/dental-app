import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import type { Setting, UpdateSettingsPayload } from './setting.model';

/**
 * Typed HTTP client for `/settings`. `update` sends only the changed values;
 * the backend validates them against the settings registry and returns the
 * full, merged list.
 */
@Injectable({ providedIn: 'root' })
export class SettingsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL).replace(/\/+$/, '');

  list(): Observable<Setting[]> {
    return this.http.get<Setting[]>(`${this.baseUrl}/settings`);
  }

  update(payload: UpdateSettingsPayload): Observable<Setting[]> {
    return this.http.patch<Setting[]>(`${this.baseUrl}/settings`, payload);
  }
}

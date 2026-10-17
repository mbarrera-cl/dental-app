import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import type {
  ImportSettingsPayload,
  Setting,
  SettingsAuditEntry,
  SettingsExport,
  UpdateSettingsPayload,
} from './setting.model';

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

  /** Raw JSON envelope with every editable setting; POST it back to `import`. */
  export(): Observable<SettingsExport> {
    return this.http.get<SettingsExport>(`${this.baseUrl}/settings/export`);
  }

  /** Persists a configuration envelope all-or-nothing; returns the merged list. */
  import(payload: ImportSettingsPayload): Observable<Setting[]> {
    return this.http.post<Setting[]>(`${this.baseUrl}/settings/import`, payload);
  }

  /** Newest-first trail of configuration changes (who/when/what). */
  audit(limit = 20): Observable<SettingsAuditEntry[]> {
    return this.http.get<SettingsAuditEntry[]>(`${this.baseUrl}/settings/audit`, {
      params: { limit },
    });
  }
}

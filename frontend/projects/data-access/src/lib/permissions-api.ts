import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import type { PermissionCatalog } from './permission.model';

/**
 * Typed HTTP client for `GET /permissions`. The catalog is code-defined and
 * static for a given deployment, so callers are expected to cache it.
 */
@Injectable({ providedIn: 'root' })
export class PermissionsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL).replace(/\/+$/, '');

  getCatalog(): Observable<PermissionCatalog> {
    return this.http.get<PermissionCatalog>(`${this.baseUrl}/permissions`);
  }
}

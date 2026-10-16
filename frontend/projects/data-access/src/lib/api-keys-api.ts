import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import type { ApiKey, CreateApiKeyPayload, CreatedApiKey } from './api-key.model';

/**
 * Typed HTTP client for `/apikeys`. Listing without `userId` returns the
 * caller's own keys; passing `userId` needs `apikeys:manage`.
 */
@Injectable({ providedIn: 'root' })
export class ApiKeysApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL).replace(/\/+$/, '');

  list(userId?: string): Observable<ApiKey[]> {
    const url = `${this.baseUrl}/apikeys`;

    return this.http.get<ApiKey[]>(
      userId === undefined ? url : `${url}?userId=${encodeURIComponent(userId)}`,
    );
  }

  /** The plain secret is returned exactly once, in the response body. */
  create(payload: CreateApiKeyPayload): Observable<CreatedApiKey> {
    return this.http.post<CreatedApiKey>(`${this.baseUrl}/apikeys`, payload);
  }

  rotate(id: string): Observable<CreatedApiKey> {
    return this.http.post<CreatedApiKey>(
      `${this.baseUrl}/apikeys/${encodeURIComponent(id)}/rotate`,
      null,
    );
  }

  revoke(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/apikeys/${encodeURIComponent(id)}`);
  }
}

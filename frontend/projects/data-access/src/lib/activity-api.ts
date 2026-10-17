import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import type {
  ActivityPage,
  ActivityPurgePreview,
  ActivityPurgeQuery,
  ActivityPurgeResult,
  ActivityQuery,
} from './activity.model';

/** Typed HTTP client for `/activity` (read + audited purge). */
@Injectable({ providedIn: 'root' })
export class ActivityApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL).replace(/\/+$/, '');

  list(query: ActivityQuery = {}): Observable<ActivityPage> {
    return this.http.get<ActivityPage>(`${this.baseUrl}/activity`, {
      params: toParams(query),
    });
  }

  previewPurge(query: ActivityPurgeQuery): Observable<ActivityPurgePreview> {
    return this.http.get<ActivityPurgePreview>(`${this.baseUrl}/activity/purge/preview`, {
      params: toParams(query),
    });
  }

  purge(query: ActivityPurgeQuery): Observable<ActivityPurgeResult> {
    return this.http.post<ActivityPurgeResult>(`${this.baseUrl}/activity/purge`, query);
  }
}

function toParams(query: object): HttpParams {
  let params = new HttpParams();

  for (const [key, value] of Object.entries(query) as Array<[string, unknown]>) {
    if (value !== undefined && value !== null && value !== '') {
      params = params.set(key, String(value));
    }
  }

  return params;
}

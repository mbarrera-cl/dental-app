import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import type {
  ConsentRecord,
  ConsentTemplate,
  RecordConsentPayload,
  UpsertConsentTemplatePayload,
} from './consent.model';
import type { Page, PageQuery } from './pagination';

/** Typed HTTP client for the informed-consents REST API. */
@Injectable({ providedIn: 'root' })
export class ConsentsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL).replace(/\/+$/, '');

  listTemplates(includeInactive = false): Observable<ConsentTemplate[]> {
    const query = includeInactive ? '?includeInactive=true' : '';

    return this.http.get<ConsentTemplate[]>(
      `${this.baseUrl}/consents/templates${query}`,
    );
  }

  upsertTemplate(
    payload: UpsertConsentTemplatePayload,
  ): Observable<ConsentTemplate> {
    return this.http.put<ConsentTemplate>(
      `${this.baseUrl}/consents/templates`,
      payload,
    );
  }

  record(
    patientId: string,
    payload: RecordConsentPayload,
  ): Observable<ConsentRecord> {
    return this.http.post<ConsentRecord>(
      `${this.baseUrl}/patients/${encodeURIComponent(patientId)}/consents`,
      payload,
    );
  }

  listByPatient(patientId: string, query: PageQuery = {}): Observable<Page<ConsentRecord>> {
    return this.http.get<Page<ConsentRecord>>(
      `${this.baseUrl}/patients/${encodeURIComponent(patientId)}/consents`,
      { params: { ...query } },
    );
  }

  getById(id: string): Observable<ConsentRecord> {
    return this.http.get<ConsentRecord>(
      `${this.baseUrl}/consents/${encodeURIComponent(id)}`,
    );
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import {
  CreateUcoProcedurePayload,
  UpdateUcoProcedurePayload,
  type UcoProcedure,
} from './uco.model';

/** Typed HTTP client for the UCO fee catalog (`/uco`). */
@Injectable({ providedIn: 'root' })
export class UcoApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL).replace(/\/+$/, '');

  /** Predictive search / list. `q` matches code, name or chapter; `active` filters. */
  list(q = '', activeOnly = false): Observable<UcoProcedure[]> {
    return this.http.get<UcoProcedure[]>(`${this.baseUrl}/uco`, {
      params: { q, ...(activeOnly ? { active: 'true' } : {}) },
    });
  }

  getById(id: string): Observable<UcoProcedure> {
    return this.http.get<UcoProcedure>(`${this.baseUrl}/uco/${encodeURIComponent(id)}`);
  }

  create(payload: CreateUcoProcedurePayload): Observable<UcoProcedure> {
    return this.http.post<UcoProcedure>(`${this.baseUrl}/uco`, payload);
  }

  update(id: string, payload: UpdateUcoProcedurePayload): Observable<UcoProcedure> {
    return this.http.patch<UcoProcedure>(`${this.baseUrl}/uco/${encodeURIComponent(id)}`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/uco/${encodeURIComponent(id)}`);
  }
}

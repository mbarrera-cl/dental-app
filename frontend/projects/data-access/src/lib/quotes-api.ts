import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import {
  CreateQuotePayload,
  Quote,
  QuoteVersion,
  UpdateQuotePayload,
} from './quote.model';

/** Typed HTTP client for the quotations API (`/quotes`). */
@Injectable({ providedIn: 'root' })
export class QuotesApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL).replace(/\/+$/, '');

  list(
    query: {
      patientId?: string;
      status?: string;
      q?: string;
      /** `exclude` (default) hides the trash; `only` lists it; `all` merges both. */
      deleted?: 'exclude' | 'only' | 'all';
    } = {},
  ): Observable<Quote[]> {
    return this.http.get<Quote[]>(`${this.baseUrl}/quotes`, { params: { ...query } });
  }

  getById(id: string): Observable<Quote> {
    return this.http.get<Quote>(`${this.baseUrl}/quotes/${encodeURIComponent(id)}`);
  }

  create(payload: CreateQuotePayload): Observable<Quote> {
    return this.http.post<Quote>(`${this.baseUrl}/quotes`, payload);
  }

  update(id: string, payload: UpdateQuotePayload): Observable<Quote> {
    return this.http.put<Quote>(`${this.baseUrl}/quotes/${encodeURIComponent(id)}`, payload);
  }

  /** Moves the quotation to the trash (soft delete, any status). */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/quotes/${encodeURIComponent(id)}`);
  }

  /** Brings a quotation back from the trash, keeping its status. */
  restore(id: string): Observable<Quote> {
    return this.http.post<Quote>(
      `${this.baseUrl}/quotes/${encodeURIComponent(id)}/restore`,
      {},
    );
  }

  duplicate(id: string): Observable<Quote> {
    return this.http.post<Quote>(
      `${this.baseUrl}/quotes/${encodeURIComponent(id)}/duplicate`,
      {},
    );
  }

  decideItem(id: string, itemId: string, status: string): Observable<Quote> {
    return this.http.patch<Quote>(
      `${this.baseUrl}/quotes/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}/status`,
      { status },
    );
  }

  setStatus(
    id: string,
    status: 'borrador' | 'sin_respuesta' | 'aprobada' | 'rechazada',
  ): Observable<Quote> {
    return this.http.patch<Quote>(`${this.baseUrl}/quotes/${encodeURIComponent(id)}/status`, { status });
  }

  /** @deprecated Use setStatus. Kept for callers that only approve/reject. */
  sanction(id: string, status: 'aprobada' | 'rechazada'): Observable<Quote> {
    return this.setStatus(id, status);
  }

  versions(id: string): Observable<QuoteVersion[]> {
    return this.http.get<QuoteVersion[]>(`${this.baseUrl}/quotes/${encodeURIComponent(id)}/versions`);
  }
}

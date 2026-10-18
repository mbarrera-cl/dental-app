import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import type { DashboardSummary } from './dashboard.model';

/** Typed HTTP client for the dashboard read model. */
@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL).replace(/\/+$/, '');

  /** One aggregated snapshot shared by every dashboard card. */
  summary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${this.baseUrl}/dashboard/summary`);
  }
}

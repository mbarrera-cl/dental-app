import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import type {
  CreatePrescriptionPayload,
  Prescription,
} from './prescription.model';
import type { Page, PageQuery } from './pagination';

/** Typed HTTP client for the prescriptions REST API. */
@Injectable({ providedIn: 'root' })
export class PrescriptionsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL).replace(/\/+$/, '');

  listByPatient(patientId: string, query: PageQuery = {}): Observable<Page<Prescription>> {
    return this.http.get<Page<Prescription>>(
      `${this.baseUrl}/patients/${encodeURIComponent(patientId)}/prescriptions`,
      { params: { ...query } },
    );
  }

  getById(id: string): Observable<Prescription> {
    return this.http.get<Prescription>(
      `${this.baseUrl}/prescriptions/${encodeURIComponent(id)}`,
    );
  }

  create(
    patientId: string,
    payload: CreatePrescriptionPayload,
  ): Observable<Prescription> {
    return this.http.post<Prescription>(
      `${this.baseUrl}/patients/${encodeURIComponent(patientId)}/prescriptions`,
      payload,
    );
  }
}

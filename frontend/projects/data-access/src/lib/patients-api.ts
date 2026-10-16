import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import type { CreatePatientPayload, Patient, UpdatePatientPayload } from './patient.model';

/** Typed HTTP client for the patients REST API (`/patients`). */
@Injectable({ providedIn: 'root' })
export class PatientsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL).replace(/\/+$/, '');

  list(): Observable<Patient[]> {
    return this.http.get<Patient[]>(`${this.baseUrl}/patients`);
  }

  getById(id: string): Observable<Patient> {
    return this.http.get<Patient>(`${this.baseUrl}/patients/${encodeURIComponent(id)}`);
  }

  /** The backend normalizes the RUT, so any spelling reaches the same row. */
  getByRut(rut: string): Observable<Patient> {
    return this.http.get<Patient>(`${this.baseUrl}/patients/rut/${encodeURIComponent(rut)}`);
  }

  create(payload: CreatePatientPayload): Observable<Patient> {
    return this.http.post<Patient>(`${this.baseUrl}/patients`, payload);
  }

  update(id: string, payload: UpdatePatientPayload): Observable<Patient> {
    return this.http.patch<Patient>(`${this.baseUrl}/patients/${encodeURIComponent(id)}`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/patients/${encodeURIComponent(id)}`);
  }
}

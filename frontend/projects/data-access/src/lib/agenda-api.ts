import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import type {
  AgendaConfig,
  AgendaPatient,
  AgendaProfessional,
  AgendaReason,
  Appointment,
  AppointmentConflict,
  CreateAppointmentPayload,
  UpdateAppointmentPayload,
} from './agenda.model';

@Injectable({ providedIn: 'root' })
export class AgendaApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL).replace(/\/+$/, '');

  config(): Observable<AgendaConfig> {
    return this.http.get<AgendaConfig>(`${this.baseUrl}/agenda/config`);
  }

  patients(query = ''): Observable<AgendaPatient[]> {
    return this.http.get<AgendaPatient[]>(`${this.baseUrl}/agenda/patients`, {
      params: { query },
    });
  }

  patient(id: string): Observable<AgendaPatient> {
    return this.http.get<AgendaPatient>(
      `${this.baseUrl}/agenda/patients/${encodeURIComponent(id)}`,
    );
  }

  reasons(): Observable<AgendaReason[]> {
    return this.http.get<AgendaReason[]>(`${this.baseUrl}/agenda/reasons`);
  }

  createReason(name: string): Observable<AgendaReason> {
    return this.http.post<AgendaReason>(`${this.baseUrl}/agenda/reasons`, { name });
  }

  updateReason(id: string, name: string): Observable<AgendaReason> {
    return this.http.patch<AgendaReason>(
      `${this.baseUrl}/agenda/reasons/${encodeURIComponent(id)}`,
      { name },
    );
  }

  deleteReason(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/agenda/reasons/${encodeURIComponent(id)}`);
  }

  professionals(): Observable<AgendaProfessional[]> {
    return this.http.get<AgendaProfessional[]>(`${this.baseUrl}/agenda/professionals`);
  }

  list(from: string, to: string, professionalId?: string): Observable<Appointment[]> {
    let params = new HttpParams().set('from', from).set('to', to);

    if (professionalId !== undefined && professionalId !== '') {
      params = params.set('professionalId', professionalId);
    }

    return this.http.get<Appointment[]>(`${this.baseUrl}/agenda/appointments`, { params });
  }

  get(id: string): Observable<Appointment> {
    return this.http.get<Appointment>(`${this.baseUrl}/agenda/appointments/${id}`);
  }

  conflicts(
    professionalId: string,
    startsAt: string,
    endsAt: string,
    excludeId?: string,
  ): Observable<AppointmentConflict[]> {
    let params = new HttpParams()
      .set('professionalId', professionalId)
      .set('startsAt', startsAt)
      .set('endsAt', endsAt);

    if (excludeId !== undefined) {
      params = params.set('excludeId', excludeId);
    }

    return this.http.get<AppointmentConflict[]>(`${this.baseUrl}/agenda/conflicts`, { params });
  }

  create(payload: CreateAppointmentPayload): Observable<Appointment> {
    return this.http.post<Appointment>(`${this.baseUrl}/agenda/appointments`, payload);
  }

  update(id: string, payload: UpdateAppointmentPayload): Observable<Appointment> {
    return this.http.patch<Appointment>(
      `${this.baseUrl}/agenda/appointments/${id}`,
      payload,
    );
  }

  cancel(id: string): Observable<Appointment> {
    return this.http.post<Appointment>(
      `${this.baseUrl}/agenda/appointments/${id}/cancel`,
      {},
    );
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import type { CreateRolePayload, Role, UpdateRolePayload } from './role.model';

/** Typed HTTP client for the roles REST API (`/roles`). */
@Injectable({ providedIn: 'root' })
export class RolesApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL).replace(/\/+$/, '');

  list(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.baseUrl}/roles`);
  }

  getById(id: string): Observable<Role> {
    return this.http.get<Role>(`${this.baseUrl}/roles/${encodeURIComponent(id)}`);
  }

  create(payload: CreateRolePayload): Observable<Role> {
    return this.http.post<Role>(`${this.baseUrl}/roles`, payload);
  }

  update(id: string, payload: UpdateRolePayload): Observable<Role> {
    return this.http.patch<Role>(`${this.baseUrl}/roles/${encodeURIComponent(id)}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/roles/${encodeURIComponent(id)}`);
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import type {
  CreateUserPayload,
  SetPasswordPayload,
  SetPasswordResult,
  UpdateUserPayload,
  User,
} from './user.model';

/** Kept here for backwards compatibility; the token lives in `api-base-url.ts`. */
export { API_BASE_URL };

/** Typed HTTP client for the users REST API (`/users`). */
@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL).replace(/\/+$/, '');

  list(): Observable<User[]> {
    return this.http.get<User[]>(`${this.baseUrl}/users`);
  }

  getById(id: string): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/users/${encodeURIComponent(id)}`);
  }

  create(payload: CreateUserPayload): Observable<User> {
    return this.http.post<User>(`${this.baseUrl}/users`, payload);
  }

  update(id: string, payload: UpdateUserPayload): Observable<User> {
    return this.http.patch<User>(`${this.baseUrl}/users/${encodeURIComponent(id)}`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/users/${encodeURIComponent(id)}`);
  }

  /** Admin password set/reset. `generate` returns the password exactly once. */
  setPassword(id: string, payload: SetPasswordPayload): Observable<SetPasswordResult> {
    return this.http.post<SetPasswordResult>(
      `${this.baseUrl}/users/${encodeURIComponent(id)}/password`,
      payload,
    );
  }

  /** Replaces the direct permissions of the user; returns the updated user. */
  updatePermissions(id: string, permissions: string[]): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/users/${encodeURIComponent(id)}/permissions`, {
      permissions,
    });
  }
}

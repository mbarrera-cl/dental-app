import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import type {
  AuthProfile,
  AuthSession,
  ChangeExpiredPasswordPayload,
  ChangePasswordPayload,
  LoginPayload,
} from './auth.model';

/**
 * Typed HTTP client for `/auth`. Login, refresh, logout and the password
 * changes run with credentials so the httpOnly refresh cookie travels with
 * them; the access token is returned in the body and stays in memory.
 */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL).replace(/\/+$/, '');

  login(payload: LoginPayload): Observable<AuthSession> {
    return this.http.post<AuthSession>(`${this.baseUrl}/auth/login`, payload, {
      withCredentials: true,
    });
  }

  /** Uses the refresh cookie; the session store guards it with single-flight. */
  refresh(): Observable<AuthSession> {
    return this.http.post<AuthSession>(`${this.baseUrl}/auth/refresh`, null, {
      withCredentials: true,
    });
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/auth/logout`, null, { withCredentials: true });
  }

  me(): Observable<AuthProfile> {
    return this.http.get<AuthProfile>(`${this.baseUrl}/auth/me`);
  }

  changePassword(payload: ChangePasswordPayload): Observable<AuthSession> {
    return this.http.post<AuthSession>(`${this.baseUrl}/auth/change-password`, payload, {
      withCredentials: true,
    });
  }

  /** For accounts whose password expired or was reset by an admin. */
  changeExpiredPassword(payload: ChangeExpiredPasswordPayload): Observable<AuthSession> {
    return this.http.post<AuthSession>(`${this.baseUrl}/auth/change-expired-password`, payload, {
      withCredentials: true,
    });
  }
}

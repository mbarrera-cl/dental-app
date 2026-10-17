import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import type {
  CreateMenuItemPayload,
  MenuItem,
  MenuReorderEntry,
  UpdateMenuItemPayload,
} from './navigation.model';

/**
 * Typed HTTP client for `/navigation`. `getMine` returns the tree filtered by
 * the caller's effective permissions (what the sidebar renders); the rest are
 * configuration endpoints guarded by `settings:read` / `settings:update`.
 * Mutations that change the shape return the fresh full tree.
 */
@Injectable({ providedIn: 'root' })
export class NavigationApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL).replace(/\/+$/, '');

  getMine(): Observable<MenuItem[]> {
    return this.http.get<MenuItem[]>(`${this.baseUrl}/navigation`);
  }

  list(): Observable<MenuItem[]> {
    return this.http.get<MenuItem[]>(`${this.baseUrl}/navigation/items`);
  }

  create(payload: CreateMenuItemPayload): Observable<MenuItem> {
    return this.http.post<MenuItem>(`${this.baseUrl}/navigation/items`, payload);
  }

  update(id: string, payload: UpdateMenuItemPayload): Observable<MenuItem> {
    return this.http.patch<MenuItem>(`${this.baseUrl}/navigation/items/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/navigation/items/${id}`);
  }

  reorder(entries: readonly MenuReorderEntry[]): Observable<MenuItem[]> {
    return this.http.put<MenuItem[]>(`${this.baseUrl}/navigation/order`, { items: entries });
  }

  reset(): Observable<MenuItem[]> {
    return this.http.post<MenuItem[]>(`${this.baseUrl}/navigation/reset`, {});
  }
}

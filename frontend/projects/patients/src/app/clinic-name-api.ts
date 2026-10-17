import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from 'data-access';

/**
 * `GET /clinic/branding` is public and carries the clinic identity; the ficha
 * header uses its name for the "Establecimiento" field. Deliberately tiny
 * until the shell grows a full branding client.
 */
@Injectable({ providedIn: 'root' })
export class ClinicNameApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL).replace(/\/+$/, '');

  clinicName(): Observable<string> {
    return this.http
      .get<{ name: string }>(`${this.baseUrl}/clinic/branding`)
      .pipe(map((branding) => branding.name));
  }
}

import {
  HttpClient,
  HttpErrorResponse,
  HttpEventType,
  HttpHeaders,
  HttpResponse,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, filter, map, of, throwError } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import type {
  BrandingSnapshot,
  ClinicBranding,
  LogoRemoval,
  LogoUpload,
  LogoUploadProgress,
} from './branding.model';

/**
 * Typed HTTP client for `/clinic`. `get` revalidates with `If-None-Match`
 * (the 304 keeps the caller's cache), `upload` reports multipart progress and
 * `remove` rolls the logo back one version.
 */
@Injectable({ providedIn: 'root' })
export class BrandingApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL).replace(/\/+$/, '');

  get(etag?: string | null): Observable<BrandingSnapshot> {
    let headers = new HttpHeaders();

    if (etag !== undefined && etag !== null && etag !== '') {
      headers = headers.set('If-None-Match', etag);
    }

    return this.http
      .get<ClinicBranding>(`${this.baseUrl}/clinic/branding`, { headers, observe: 'response' })
      .pipe(
        map((response) =>
          this.snapshotOf(response.status, response.body, response.headers.get('ETag'), etag),
        ),
        catchError((error: unknown) =>
          // The 304 may surface as an error (status) or as an empty success,
          // depending on how the browser's HTTP cache handled it.
          error instanceof HttpErrorResponse && error.status === 304
            ? of({ branding: null, etag: etag ?? null })
            : throwError(() => error),
        ),
      );
  }

  /** Multipart upload with progress events; the response arrives at 100 %. */
  upload(file: File): Observable<LogoUploadProgress> {
    const form = new FormData();
    form.append('file', file);

    return this.http
      .post<LogoUpload>(`${this.baseUrl}/clinic/logo`, form, {
        reportProgress: true,
        observe: 'events',
      })
      .pipe(
        filter(
          (event) =>
            event.type === HttpEventType.UploadProgress || event.type === HttpEventType.Response,
        ),
        map((event) => {
          if (event.type === HttpEventType.UploadProgress) {
            const total = event.total ?? 0;

            return { progress: total > 0 ? Math.round((event.loaded / total) * 100) : 0 };
          }

          return { progress: 100, upload: (event as HttpResponse<LogoUpload>).body! };
        }),
      );
  }

  /** Removes the current logo, rolling back to the previous version. */
  remove(): Observable<LogoRemoval> {
    return this.http.delete<LogoRemoval>(`${this.baseUrl}/clinic/logo`);
  }

  private snapshotOf(
    status: number,
    body: ClinicBranding | null,
    responseEtag: string | null,
    requestEtag: string | null | undefined,
  ): BrandingSnapshot {
    if (status === 304 || body === null) {
      return { branding: null, etag: requestEtag ?? null };
    }

    return { branding: body, etag: responseEtag ?? requestEtag ?? null };
  }
}

/**
 * Absolute URL of a logo variant. `hash` (the asset's sha256) travels as a
 * query parameter, so URLs change with the bytes and can be cached forever.
 */
export function assetUrl(baseUrl: string, variant: string, hash?: string | null): string {
  const base = baseUrl.replace(/\/+$/, '');

  return hash ? `${base}/clinic/assets/${variant}?v=${hash}` : `${base}/clinic/assets/${variant}`;
}

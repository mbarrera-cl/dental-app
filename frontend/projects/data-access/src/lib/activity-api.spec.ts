import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from './api-base-url';
import { ActivityApi } from './activity-api';
import type { ActivityPage } from './activity.model';

const BASE_URL = 'http://api.test/v1/';

const PAGE: ActivityPage = {
  config: { enabled: true, panelLimit: 20, refreshSeconds: 60, badge: true },
  items: [],
  nextCursor: 'cursor-2',
};

describe('ActivityApi', () => {
  let api: ActivityApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE_URL },
      ],
    });

    api = TestBed.inject(ActivityApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('lists activity with the given filters', () => {
    let page: ActivityPage | undefined;

    api
      .list({ limit: 25, module: 'patients', outcome: 'failure', cursor: 'abc' })
      .subscribe((value) => {
        page = value;
      });

    const request = http.expectOne(
      (candidate) => candidate.url === `${BASE_URL}activity`,
    );

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('limit')).toBe('25');
    expect(request.request.params.get('module')).toBe('patients');
    expect(request.request.params.get('outcome')).toBe('failure');
    expect(request.request.params.get('cursor')).toBe('abc');

    request.flush(PAGE);
    expect(page).toEqual(PAGE);
  });

  it('omits empty filters', () => {
    api.list({ limit: 20, module: undefined, from: '' }).subscribe();

    const request = http.expectOne((candidate) => candidate.url === `${BASE_URL}activity`);
    expect(request.request.params.keys()).toEqual(['limit']);
    request.flush(PAGE);
  });

  it('previews and performs a purge', () => {
    api.previewPurge({ all: true }).subscribe();

    const preview = http.expectOne(
      (candidate) => candidate.url === `${BASE_URL}activity/purge/preview`,
    );
    expect(preview.request.method).toBe('GET');
    expect(preview.request.params.get('all')).toBe('true');
    preview.flush({ count: 3 });

    api.purge({ before: '2026-01-01T00:00:00.000Z' }).subscribe();

    const purge = http.expectOne(`${BASE_URL}activity/purge`);
    expect(purge.request.method).toBe('POST');
    expect(purge.request.body).toEqual({ before: '2026-01-01T00:00:00.000Z' });
    purge.flush({ deleted: 3, at: '2026-10-17T10:00:00.000Z' });
  });
});

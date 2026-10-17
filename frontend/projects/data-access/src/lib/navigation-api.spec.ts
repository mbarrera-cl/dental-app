import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from './api-base-url';
import type { MenuItem } from './navigation.model';
import { NavigationApi } from './navigation-api';

const BASE_URL = 'http://api.test/v1/';

const PATIENTS: MenuItem = {
  id: 'menu-1',
  kind: 'item',
  label: null,
  icon: 'lucideStethoscope',
  routeKey: 'patients',
  externalUrl: null,
  parentId: null,
  position: 0,
  requiredPermission: 'patients:read',
  enabled: true,
  children: [],
};

describe('NavigationApi', () => {
  let api: NavigationApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE_URL },
      ],
    });

    api = TestBed.inject(NavigationApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('reads the permission-filtered tree for the sidebar', () => {
    let tree: MenuItem[] | undefined;
    api.getMine().subscribe((value) => {
      tree = value;
    });

    const request = http.expectOne(`${BASE_URL}navigation`);
    expect(request.request.method).toBe('GET');

    request.flush([PATIENTS]);
    expect(tree).toEqual([PATIENTS]);
  });

  it('reads the full tree for the editor', () => {
    api.list().subscribe();

    const request = http.expectOne(`${BASE_URL}navigation/items`);
    expect(request.request.method).toBe('GET');
    request.flush([PATIENTS]);
  });

  it('creates, updates and removes entries', () => {
    api.create({ kind: 'item', routeKey: 'patients' }).subscribe();

    const create = http.expectOne(`${BASE_URL}navigation/items`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ kind: 'item', routeKey: 'patients' });
    create.flush(PATIENTS);

    api.update(PATIENTS.id, { enabled: false }).subscribe();

    const update = http.expectOne(`${BASE_URL}navigation/items/menu-1`);
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual({ enabled: false });
    update.flush({ ...PATIENTS, enabled: false });

    api.remove(PATIENTS.id).subscribe();

    const remove = http.expectOne(`${BASE_URL}navigation/items/menu-1`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
  });

  it('sends drag & drop batches wrapped in an items array', () => {
    api.reorder([{ id: PATIENTS.id, parentId: null, position: 3 }]).subscribe();

    const request = http.expectOne(`${BASE_URL}navigation/order`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      items: [{ id: PATIENTS.id, parentId: null, position: 3 }],
    });
    request.flush([PATIENTS]);
  });

  it('resets the menu to the default seed', () => {
    api.reset().subscribe();

    const request = http.expectOne(`${BASE_URL}navigation/reset`);
    expect(request.request.method).toBe('POST');
    request.flush([PATIENTS]);
  });
});

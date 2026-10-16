import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { User } from './user.model';
import { API_BASE_URL, UsersApi } from './users-api';

const BASE_URL = 'http://api.test/v1/';

const ADA: User = {
  id: 'user-1',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  createdAt: '2026-10-16T10:00:00.000Z',
};

describe('UsersApi', () => {
  let api: UsersApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE_URL },
      ],
    });

    api = TestBed.inject(UsersApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('lists users trimming trailing slashes from the base URL', () => {
    let received: User[] | undefined;
    api.list().subscribe((users) => (received = users));

    const request = http.expectOne('http://api.test/v1/users');
    expect(request.request.method).toBe('GET');
    request.flush([ADA]);

    expect(received).toEqual([ADA]);
  });

  it('gets a single user', () => {
    api.getById('user-1').subscribe();
    http.expectOne('http://api.test/v1/users/user-1').flush(ADA);
  });

  it('creates a user with the payload as body', () => {
    let received: User | undefined;
    api.create({ name: 'Ada Lovelace', email: 'ada@example.com' }).subscribe((user) => (received = user));

    const request = http.expectOne('http://api.test/v1/users');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ name: 'Ada Lovelace', email: 'ada@example.com' });
    request.flush(ADA);

    expect(received).toEqual(ADA);
  });

  it('updates a user with PATCH and an encoded id', () => {
    api.update('id with spaces', { name: 'Ada King' }).subscribe();

    const request = http.expectOne('http://api.test/v1/users/id%20with%20spaces');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ name: 'Ada King' });
    request.flush({ ...ADA, name: 'Ada King' });
  });

  it('deletes a user', () => {
    api.delete('user-1').subscribe();

    const request = http.expectOne('http://api.test/v1/users/user-1');
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 200, statusText: 'OK' });
  });

  it('resets a password, optionally asking the backend to generate it', () => {
    let generated: string | undefined;
    api.setPassword('user-1', { generate: true }).subscribe((result) => {
      generated = result.generatedPassword;
    });

    const request = http.expectOne('http://api.test/v1/users/user-1/password');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ generate: true });

    request.flush({ generatedPassword: 'Fancy-123!' });
    expect(generated).toBe('Fancy-123!');
  });

  it('replaces the direct permissions of a user', () => {
    api.updatePermissions('user-1', ['users:read', 'roles:read']).subscribe();

    const request = http.expectOne('http://api.test/v1/users/user-1/permissions');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ permissions: ['users:read', 'roles:read'] });
    request.flush({ ...ADA, directPermissions: ['users:read', 'roles:read'] });
  });
});

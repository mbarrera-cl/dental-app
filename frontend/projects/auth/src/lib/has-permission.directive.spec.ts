import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { AuthApi, type AuthSession } from 'data-access';
import { firstValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HasPermissionDirective } from './has-permission.directive';
import { SessionStore } from './session-store';

const SESSION: AuthSession = {
  accessToken: 'token-1',
  expiresIn: 900,
  user: { id: 'user-1', email: 'ada@example.com', name: 'Ada Lovelace', status: 'active' },
  roles: [],
  permissions: {
    fromRoles: [],
    direct: ['users:read', 'users:create'],
    effective: ['users:read', 'users:create'],
  },
};

@Component({
  imports: [HasPermissionDirective],
  template: `
    <span id="read" *hasPermission="'users:read'">read</span>
    <span id="delete" *hasPermission="'users:delete'">delete</span>
    <span id="any" *hasPermission="['users:delete', 'users:create']; mode: 'any'">any</span>
    <span id="all" *hasPermission="['users:read', 'users:create']">all</span>
  `,
})
class HostComponent {}

describe('HasPermissionDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let store: SessionStore;
  let api: { login: ReturnType<typeof vi.fn> };

  const has = (id: string) => fixture.nativeElement.querySelector(`#${id}`) !== null;

  beforeEach(async () => {
    api = { login: vi.fn(() => of(SESSION)) };

    TestBed.configureTestingModule({ providers: [{ provide: AuthApi, useValue: api }] });

    store = TestBed.inject(SessionStore);
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders nothing while there is no session', () => {
    expect(has('read')).toBe(false);
    expect(has('any')).toBe(false);
    expect(has('all')).toBe(false);
  });

  it('renders the templates whose keys are held after login', async () => {
    await firstValueFrom(store.login({ email: 'ada@example.com', password: 'x' }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(has('read')).toBe(true);
    expect(has('all')).toBe(true);
    expect(has('any')).toBe(true);
    expect(has('delete')).toBe(false);
  });

  it('honours the any mode with a single matching key', async () => {
    await firstValueFrom(store.login({ email: 'ada@example.com', password: 'x' }));
    fixture.detectChanges();
    await fixture.whenStable();

    // `any` renders even though users:delete is missing.
    expect(has('any')).toBe(true);
  });

  it('removes the views again when the session is dropped', async () => {
    await firstValueFrom(store.login({ email: 'ada@example.com', password: 'x' }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(has('read')).toBe(true);

    store.clear();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(has('read')).toBe(false);
    expect(has('all')).toBe(false);
  });
});

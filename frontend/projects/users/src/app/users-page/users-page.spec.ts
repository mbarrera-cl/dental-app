import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideAppTransloco, provideSpartanHlm } from 'ui';
import type { User } from 'data-access';
import { UsersPage } from './users-page';

const USERS: User[] = [
  {
    id: 'user-1',
    email: 'ada@example.com',
    name: 'Ada Lovelace',
    createdAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'user-2',
    email: 'grace@example.com',
    name: 'Grace Hopper',
    createdAt: '2026-10-02T08:00:00.000Z',
  },
];

describe('UsersPage', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsersPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideAppTransloco(), provideSpartanHlm()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  async function render() {
    const fixture = TestBed.createComponent(UsersPage);
    fixture.detectChanges();

    http.expectOne('http://localhost:3000/users').flush(USERS);

    await fixture.whenStable();
    fixture.detectChanges();

    return fixture;
  }

  it('shows skeleton rows while loading', () => {
    const fixture = TestBed.createComponent(UsersPage);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);

    http.expectOne('http://localhost:3000/users').flush([]);
  });

  it('renders the users returned by the API', async () => {
    const fixture = await render();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Ada Lovelace');
    expect(compiled.textContent).toContain('grace@example.com');
    expect(compiled.textContent).toContain('2 de 2 usuarios');
  });

  it('filters users as you type in the search box', async () => {
    const fixture = await render();
    const compiled = fixture.nativeElement as HTMLElement;

    const search = compiled.querySelector<HTMLInputElement>('[data-testid="users-search"]');
    expect(search).not.toBeNull();

    search!.value = 'ada';
    search!.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Ada Lovelace');
    expect(compiled.textContent).not.toContain('Grace Hopper');
  });

  it('shows a translated error banner when the API is unreachable', async () => {
    const fixture = TestBed.createComponent(UsersPage);
    fixture.detectChanges();

    http.expectOne('http://localhost:3000/users').error(new ProgressEvent('error'));

    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No se pudo conectar con la API');
  });
});

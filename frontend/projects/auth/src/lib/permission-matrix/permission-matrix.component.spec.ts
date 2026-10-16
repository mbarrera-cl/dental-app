import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import type { PermissionCatalog } from 'data-access';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionMatrixComponent } from './permission-matrix.component';

const CATALOG: PermissionCatalog = {
  categories: [
    {
      id: 'users',
      description: 'User administration',
      permissions: [
        { key: 'users:read', action: 'read', description: 'Read users' },
        { key: 'users:create', action: 'create', description: 'Create users' },
      ],
    },
    {
      id: 'roles',
      description: 'Role administration',
      permissions: [{ key: 'roles:read', action: 'read', description: 'Read roles' }],
    },
  ],
};

function translocoMock(bundle: Record<string, Record<string, string>> = {}) {
  return { translateObject: vi.fn((key: string) => bundle[key] ?? {}) };
}

describe('PermissionMatrixComponent', () => {
  let fixture: ComponentFixture<PermissionMatrixComponent>;
  let emitted: string[][];

  const setup = (inputs: Record<string, unknown> = {}) => {
    fixture = TestBed.createComponent(PermissionMatrixComponent);
    fixture.componentRef.setInput('catalog', CATALOG);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    emitted = [];
    fixture.componentInstance.selectedChange.subscribe((value) => emitted.push([...value]));
    fixture.detectChanges();
  };

  const category = (id: string): HTMLElement =>
    fixture.nativeElement.querySelector(`[data-testid="matrix-category"][data-category="${id}"]`);
  const counter = (id: string): string =>
    category(id).querySelector('[data-testid="matrix-counter"]')!.textContent!.trim();
  const itemKeys = (id: string): string[] =>
    [...category(id).querySelectorAll<HTMLElement>('[data-testid="matrix-item"]')].map(
      (item) => item.getAttribute('data-key')!,
    );
  const checkbox = (key: string): HTMLInputElement =>
    fixture.nativeElement.querySelector(`[data-testid="matrix-item"][data-key="${key}"] input`);
  const selectAll = (id: string): HTMLButtonElement =>
    category(id).querySelector('[data-testid="matrix-select-all"]')!;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: TranslocoService, useValue: translocoMock() }],
    });
    setup();
  });

  it('renders the catalog with backend descriptions as i18n fallback', () => {
    expect(category('users').textContent).toContain('User administration');
    expect(itemKeys('users')).toEqual(['users:read', 'users:create']);
    expect(fixture.nativeElement.querySelector('[data-testid="matrix-item"][data-key="users:read"]').textContent).toContain(
      'Read users',
    );
    expect(fixture.nativeElement.querySelector('[data-testid="matrix-search"]').placeholder).toBe(
      'Search permissions',
    );
  });

  it('uses translations when the bundle provides them', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: TranslocoService,
          useValue: translocoMock({
            'permissions.categories': { users: 'Usuarios' },
            'permissions.items': { 'users:read': 'Leer usuarios' },
            'permissions.matrix': { search: 'Buscar permisos', viaRole: 'vía rol' },
          }),
        },
      ],
    });
    setup();

    expect(category('users').textContent).toContain('Usuarios');
    expect(fixture.nativeElement.querySelector('[data-testid="matrix-item"][data-key="users:read"]').textContent).toContain(
      'Leer usuarios',
    );
    expect(fixture.nativeElement.querySelector('[data-testid="matrix-search"]').placeholder).toBe(
      'Buscar permisos',
    );
  });

  it('shows the n/m counter for the selection', () => {
    expect(counter('users')).toBe('0/2');
    expect(counter('roles')).toBe('0/1');

    fixture.componentRef.setInput('selected', ['users:read', 'roles:read']);
    fixture.detectChanges();

    expect(counter('users')).toBe('1/2');
    expect(counter('roles')).toBe('1/1');
  });

  it('emits the new selection when a permission is toggled', () => {
    checkbox('users:create').click();

    expect(emitted).toEqual([['users:create']]);

    fixture.componentRef.setInput('selected', ['users:create']);
    fixture.detectChanges();
    expect(counter('users')).toBe('1/2');

    checkbox('users:create').click();
    expect(emitted[1]).toEqual([]);
  });

  it('selects and clears a whole category, skipping inherited keys', () => {
    fixture.componentRef.setInput('inherited', ['users:create']);
    fixture.detectChanges();

    selectAll('users').click();

    expect(emitted[0]).toEqual(['users:read']);

    fixture.componentRef.setInput('selected', ['users:read']);
    fixture.detectChanges();
    expect(counter('users')).toBe('2/2');

    selectAll('users').click();
    expect(emitted[1]).toEqual([]);
  });

  it('marks inherited permissions as checked, locked and labelled', () => {
    fixture.componentRef.setInput('inherited', ['users:create']);
    fixture.detectChanges();

    const inherited = checkbox('users:create');
    expect(inherited.checked).toBe(true);
    expect(inherited.disabled).toBe(true);
    expect(counter('users')).toBe('1/2');

    const badge = fixture.nativeElement.querySelector(
      '[data-testid="matrix-item"][data-key="users:create"] [data-testid="matrix-inherited"]',
    );
    expect(badge.textContent.trim()).toBe('via role');

    inherited.click();
    expect(emitted).toEqual([]);
  });

  it('locks everything down in read-only mode', () => {
    fixture.componentRef.setInput('readonly', true);
    fixture.componentRef.setInput('selected', ['users:read']);
    fixture.detectChanges();

    expect(checkbox('users:create').disabled).toBe(true);
    expect(selectAll('users').disabled).toBe(true);

    checkbox('users:create').click();
    expect(emitted).toEqual([]);
  });

  it('filters by search term, hiding empty categories', () => {
    const search = fixture.nativeElement.querySelector('[data-testid="matrix-search"]') as HTMLInputElement;
    search.value = 'create';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('[data-testid="matrix-category"]').length).toBe(1);
    expect(itemKeys('users')).toEqual(['users:create']);

    search.value = 'zzz';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="matrix-empty"]')).not.toBeNull();
  });

  it('collapses and expands a category', () => {
    const header = category('users').querySelector('button')!;
    header.click();
    fixture.detectChanges();

    expect(itemKeys('users')).toEqual([]);

    header.click();
    fixture.detectChanges();

    expect(itemKeys('users')).toEqual(['users:read', 'users:create']);
  });
});

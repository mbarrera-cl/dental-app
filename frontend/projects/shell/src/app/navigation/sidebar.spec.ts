import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MenuItem } from 'data-access';
import { provideAppTransloco, provideSpartanHlm } from 'ui';
import { NavigationStore } from './navigation-store';
import { Sidebar } from './sidebar';

const item = (overrides: Partial<MenuItem>): MenuItem => ({
  id: 'menu-x',
  kind: 'item',
  label: null,
  icon: null,
  routeKey: null,
  externalUrl: null,
  parentId: null,
  position: 0,
  requiredPermission: null,
  enabled: true,
  children: [],
  ...overrides,
});

/**
 * A realistic tree: one registry item (translated label), one group with a
 * registry child, a literal external link, a divider and a dead route key.
 */
const TREE: MenuItem[] = [
  item({ id: 'menu-patients', routeKey: 'patients', icon: 'lucideStethoscope' }),
  item({ id: 'menu-divider', kind: 'divider', position: 1 }),
  item({
    id: 'menu-admin',
    kind: 'group',
    label: 'Administración',
    icon: 'lucideSettings',
    position: 2,
    children: [
      item({ id: 'menu-roles', routeKey: 'admin.roles', parentId: 'menu-admin' }),
      item({
        id: 'menu-intranet',
        label: 'Intranet',
        externalUrl: 'https://intranet.example.com/',
        parentId: 'menu-admin',
        position: 1,
      }),
    ],
  }),
  item({ id: 'menu-ghost', routeKey: 'ghost.route', position: 3 }),
];

describe('Sidebar', () => {
  let store: NavigationStore;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Sidebar],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAppTransloco(),
        provideSpartanHlm(),
      ],
    }).compileComponents();

    store = TestBed.inject(NavigationStore);
    http = TestBed.inject(HttpTestingController);
  });

  const render = async (tree: MenuItem[] = TREE): Promise<ComponentFixture<Sidebar>> => {
    store.load();
    http.expectOne('http://localhost:3000/navigation').flush(tree);

    const fixture = TestBed.createComponent(Sidebar);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    return fixture;
  };

  it('renders registry labels translated and literal group labels as-is', async () => {
    const fixture = await render();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('nav')?.getAttribute('aria-label')).toBe('Menú de navegación');
    expect(compiled.querySelector('a[href="/patients"]')?.textContent).toContain('Pacientes');
    expect(compiled.textContent).toContain('Administración');
    expect(compiled.textContent).toContain('Roles');
  });

  it('never renders route keys that left the registry', async () => {
    const fixture = await render();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).not.toContain('ghost');
    expect(compiled.querySelectorAll('a')).toHaveLength(3);
  });

  it('renders dividers as separators', async () => {
    const fixture = await render();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelectorAll('hr')).toHaveLength(1);
  });

  it('opens external links in a new tab with a safe rel', async () => {
    const fixture = await render();
    const compiled = fixture.nativeElement as HTMLElement;
    const external = compiled.querySelector('a[href="https://intranet.example.com/"]');

    expect(external?.getAttribute('target')).toBe('_blank');
    expect(external?.getAttribute('rel')).toContain('noopener');
  });

  it('collapses and expands groups through an accessible toggle', async () => {
    const fixture = await render();
    const compiled = fixture.nativeElement as HTMLElement;
    const toggle = compiled.querySelector<HTMLButtonElement>('button[aria-expanded]');

    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(compiled.textContent).toContain('Roles');

    toggle?.click();
    fixture.detectChanges();

    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(compiled.textContent).not.toContain('Roles');

    toggle?.click();
    fixture.detectChanges();

    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(compiled.textContent).toContain('Roles');
  });

  it('renders nothing (but stays mountable) with an empty tree', async () => {
    const fixture = await render([]);
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('nav')).not.toBeNull();
    expect(compiled.querySelectorAll('a')).toHaveLength(0);
  });
});

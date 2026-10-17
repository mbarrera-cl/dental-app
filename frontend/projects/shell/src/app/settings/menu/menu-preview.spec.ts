import { describe, expect, it } from 'vitest';
import type { MenuItem } from 'data-access';
import { previewMenuTree } from './menu-preview';

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

const known = (routeKey: string): boolean => routeKey !== 'ghost.route';

const ids = (items: readonly MenuItem[]): string[] => items.map((node) => node.id);

describe('previewMenuTree', () => {
  it('drops disabled entries and entries whose permission is missing', () => {
    const tree = [
      item({ id: 'a', routeKey: 'patients', requiredPermission: 'patients:read' }),
      item({ id: 'b', routeKey: 'users', requiredPermission: 'users:read' }),
      item({ id: 'c', routeKey: 'dashboard', enabled: false }),
    ];

    const preview = previewMenuTree(tree, new Set(['patients:read']), known);

    expect(ids(preview)).toEqual(['a']);
  });

  it('hides items whose route key left the registry but keeps external links', () => {
    const tree = [
      item({ id: 'ghost', routeKey: 'ghost.route' }),
      item({ id: 'intranet', label: 'Intranet', externalUrl: 'https://intranet.example.com/' }),
    ];

    const preview = previewMenuTree(tree, new Set(), known);

    expect(ids(preview)).toEqual(['intranet']);
  });

  it('prunes groups without visible children', () => {
    const tree = [
      item({
        id: 'admin',
        kind: 'group',
        label: 'Administración',
        children: [item({ id: 'roles', routeKey: 'admin.roles', requiredPermission: 'roles:read' })],
      }),
      item({ id: 'patients', routeKey: 'patients' }),
    ];

    const preview = previewMenuTree(tree, new Set(), known);

    expect(ids(preview)).toEqual(['patients']);
  });

  it('keeps dividers only between two visible entries', () => {
    const tree = [
      item({ id: 'leading', kind: 'divider' }),
      item({ id: 'a', routeKey: 'patients' }),
      item({ id: 'double-1', kind: 'divider' }),
      item({ id: 'double-2', kind: 'divider' }),
      item({ id: 'b', routeKey: 'dashboard' }),
      item({ id: 'trailing', kind: 'divider' }),
      item({ id: 'hidden', routeKey: 'users', enabled: false }),
    ];

    const preview = previewMenuTree(tree, new Set(), known);

    expect(ids(preview)).toEqual(['a', 'b']);
  });

  it('filters children independently and keeps the surviving order', () => {
    const tree = [
      item({
        id: 'admin',
        kind: 'group',
        label: 'Administración',
        children: [
          item({ id: 'roles', routeKey: 'admin.roles', requiredPermission: 'roles:read' }),
          item({ id: 'hidden', routeKey: 'admin.settings', enabled: false }),
          item({ id: 'menu', routeKey: 'settings.menu', requiredPermission: 'settings:read' }),
        ],
      }),
    ];

    const preview = previewMenuTree(tree, new Set(['settings:read']), known);

    expect(ids(preview[0]!.children)).toEqual(['menu']);
  });
});

import { describe, expect, it } from 'vitest';
import type { MenuItem } from 'data-access';
import { cloneTree, dropNode, findNode, shiftNode, toReorderEntries } from './menu-tree-edit';

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

// root: patients, divider, admin(roles, settings), account(apiKeys)
const tree = (): MenuItem[] => [
  item({ id: 'patients', routeKey: 'patients', position: 0 }),
  item({ id: 'divider', kind: 'divider', position: 1 }),
  item({
    id: 'admin',
    kind: 'group',
    label: 'Administración',
    position: 2,
    children: [
      item({ id: 'roles', routeKey: 'admin.roles', parentId: 'admin', position: 0 }),
      item({ id: 'settings', routeKey: 'admin.settings', parentId: 'admin', position: 1 }),
    ],
  }),
  item({
    id: 'account',
    kind: 'group',
    label: 'Mi cuenta',
    position: 3,
    children: [item({ id: 'apiKeys', routeKey: 'account.apiKeys', parentId: 'account', position: 0 })],
  }),
];

const ids = (items: readonly MenuItem[]): string[] => items.map((node) => node.id);

describe('menu-tree-edit', () => {
  it('clones the tree deeply', () => {
    const original = tree();
    const copy = cloneTree(original);

    copy[0]!.position = 99;
    copy[2]!.children[0]!.label = 'Mutado';

    expect(original[0]!.position).toBe(0);
    expect(original[2]!.children[0]!.label).toBeNull();
    expect(copy[2]!.children[0]).not.toBe(original[2]!.children[0]);
    expect(copy[2]).not.toBe(original[2]);
  });

  it('finds nodes at any depth', () => {
    expect(findNode(tree(), 'settings')?.routeKey).toBe('admin.settings');
    expect(findNode(tree(), 'missing')).toBeNull();
  });

  it('shifts a node inside its sibling list and renumbers positions', () => {
    const moved = shiftNode(tree(), 'divider', 1);

    expect(moved).not.toBeNull();
    expect(ids(moved!)).toEqual(['patients', 'admin', 'divider', 'account']);
    expect(moved!.map((node) => node.position)).toEqual([0, 1, 2, 3]);

    const nested = shiftNode(tree(), 'roles', 1);
    expect(ids(nested![2]!.children)).toEqual(['settings', 'roles']);
    expect(nested![2]!.children.map((node) => node.position)).toEqual([0, 1]);
  });

  it('refuses shifts beyond the boundaries or for unknown ids', () => {
    expect(shiftNode(tree(), 'patients', -1)).toBeNull();
    expect(shiftNode(tree(), 'account', 1)).toBeNull();
    expect(shiftNode(tree(), 'missing', 1)).toBeNull();
  });

  it('reorders within the same list (CDK semantics)', () => {
    const moved = dropNode(tree(), {
      movedId: 'patients',
      toParentId: null,
      toIndex: 2,
      sameList: true,
    });

    expect(moved).not.toBeNull();
    expect(ids(moved!)).toEqual(['divider', 'admin', 'patients', 'account']);
    expect(moved!.map((node) => node.position)).toEqual([0, 1, 2, 3]);
  });

  it('moves a node into a group and adopts its parent id', () => {
    const moved = dropNode(tree(), {
      movedId: 'patients',
      toParentId: 'admin',
      toIndex: 1,
      sameList: false,
    });

    expect(moved).not.toBeNull();
    expect(ids(moved!)).toEqual(['divider', 'admin', 'account']);

    const admin = findNode(moved!, 'admin')!;
    expect(ids(admin.children)).toEqual(['roles', 'patients', 'settings']);
    expect(admin.children[1]!.parentId).toBe('admin');
    expect(admin.children.map((node) => node.position)).toEqual([0, 1, 2]);
  });

  it('moves a node out of a group back to the top level', () => {
    const moved = dropNode(tree(), {
      movedId: 'apiKeys',
      toParentId: null,
      toIndex: 0,
      sameList: false,
    });

    expect(moved).not.toBeNull();
    expect(ids(moved!)).toEqual(['apiKeys', 'patients', 'divider', 'admin', 'account']);
    expect(moved![0]!.parentId).toBeNull();
    expect(moved!.map((node) => node.position)).toEqual([0, 1, 2, 3, 4]);

    const account = findNode(moved!, 'account')!;
    expect(account.children).toEqual([]);
  });

  it('rejects moves that break the domain rules', () => {
    // Groups are top-level only.
    expect(
      dropNode(tree(), { movedId: 'admin', toParentId: 'account', toIndex: 0, sameList: false }),
    ).toBeNull();

    // The destination must be an existing group.
    expect(
      dropNode(tree(), { movedId: 'patients', toParentId: 'roles', toIndex: 0, sameList: false }),
    ).toBeNull();

    // Unknown ids and inconsistent same-list calls never move anything.
    expect(
      dropNode(tree(), { movedId: 'missing', toParentId: null, toIndex: 0, sameList: false }),
    ).toBeNull();
    expect(
      dropNode(tree(), { movedId: 'patients', toParentId: 'admin', toIndex: 0, sameList: true }),
    ).toBeNull();
  });

  it('flattens the tree into the reorder payload', () => {
    expect(toReorderEntries(tree())).toEqual([
      { id: 'patients', parentId: null, position: 0 },
      { id: 'divider', parentId: null, position: 1 },
      { id: 'admin', parentId: null, position: 2 },
      { id: 'roles', parentId: 'admin', position: 0 },
      { id: 'settings', parentId: 'admin', position: 1 },
      { id: 'account', parentId: null, position: 3 },
      { id: 'apiKeys', parentId: 'account', position: 0 },
    ]);
  });
});

import { MenuItem } from './menu-item.entity.js';
import { buildMenuTree, visibleMenuTree, type MenuTreeNode } from './menu-tree.js';

const labelOf = (item: MenuItem): string => item.label ?? item.routeKey ?? item.kind;

const outline = (nodes: readonly MenuTreeNode[]): unknown[] =>
  nodes.map((node) => ({ node: labelOf(node.item), children: outline(node.children) }));

describe('buildMenuTree', () => {
  it('nests children under their groups and orders siblings by position', () => {
    const group = MenuItem.create({ kind: 'group', label: 'Admin' });
    const patients = MenuItem.create({ kind: 'item', routeKey: 'patients' });
    const users = MenuItem.create({ kind: 'item', routeKey: 'users' });
    const child = MenuItem.create({ kind: 'item', routeKey: 'admin.roles', parentId: group.id });

    users.setPosition(0);
    patients.setPosition(1);
    child.setPosition(0);

    const tree = buildMenuTree([group, patients, users, child]);

    expect(outline(tree)).toEqual([
      { node: 'Admin', children: [{ node: 'admin.roles', children: [] }] },
      { node: 'users', children: [] },
      { node: 'patients', children: [] },
    ]);
  });

  it('breaks position ties with the input (insertion) order', () => {
    const first = MenuItem.create({ kind: 'item', routeKey: 'patients' });
    const second = MenuItem.create({ kind: 'item', routeKey: 'users' });

    expect(outline(buildMenuTree([first, second]))).toEqual([
      { node: 'patients', children: [] },
      { node: 'users', children: [] },
    ]);
  });
});

describe('visibleMenuTree', () => {
  const buildFixture = (): MenuItem[] => {
    const patients = MenuItem.create({
      kind: 'item',
      routeKey: 'patients',
      requiredPermission: 'patients:read',
    });
    const users = MenuItem.create({
      kind: 'item',
      routeKey: 'users',
      requiredPermission: 'users:read',
    });
    const disabled = MenuItem.create({ kind: 'item', routeKey: 'dashboard' });
    disabled.setEnabled(false);

    const group = MenuItem.create({ kind: 'group', label: 'Admin' });
    const roles = MenuItem.create({
      kind: 'item',
      routeKey: 'admin.roles',
      parentId: group.id,
      requiredPermission: 'roles:read',
    });
    const settings = MenuItem.create({
      kind: 'item',
      routeKey: 'admin.settings',
      parentId: group.id,
      requiredPermission: 'settings:read',
    });

    const divider = MenuItem.create({ kind: 'divider' });

    users.setPosition(0);
    divider.setPosition(1);
    group.setPosition(2);
    disabled.setPosition(3);
    patients.setPosition(4);
    roles.setPosition(0);
    settings.setPosition(1);

    return [patients, users, disabled, group, roles, settings, divider];
  };

  it('drops entries whose permission the principal lacks and prunes empty groups', () => {
    const tree = visibleMenuTree(buildFixture(), new Set(['patients:read', 'settings:read']));

    expect(outline(tree)).toEqual([
      { node: 'Admin', children: [{ node: 'admin.settings', children: [] }] },
      { node: 'patients', children: [] },
    ]);
  });

  it('keeps only dividers that separate visible entries', () => {
    const tree = visibleMenuTree(
      buildFixture(),
      new Set(['users:read', 'patients:read', 'roles:read', 'settings:read']),
    );

    expect(outline(tree)).toEqual([
      { node: 'users', children: [] },
      { node: 'divider', children: [] },
      { node: 'Admin', children: [
        { node: 'admin.roles', children: [] },
        { node: 'admin.settings', children: [] },
      ] },
      { node: 'patients', children: [] },
    ]);
  });

  it('hides disabled entries from everyone', () => {
    const tree = visibleMenuTree(
      buildFixture(),
      new Set(['patients:read', 'users:read', 'dashboard:read', 'roles:read', 'settings:read']),
    );

    expect(outline(tree).some((node) => JSON.stringify(node).includes('dashboard'))).toBe(false);
  });

  it('drops leading, trailing and consecutive dividers', () => {
    const leading = MenuItem.create({ kind: 'divider' });
    const patients = MenuItem.create({ kind: 'item', routeKey: 'patients' });
    const first = MenuItem.create({ kind: 'divider' });
    const second = MenuItem.create({ kind: 'divider' });
    const trailing = MenuItem.create({ kind: 'divider' });

    leading.setPosition(0);
    patients.setPosition(1);
    first.setPosition(2);
    second.setPosition(3);
    trailing.setPosition(4);

    const tree = visibleMenuTree([leading, patients, first, second, trailing], new Set());

    expect(outline(tree)).toEqual([{ node: 'patients', children: [] }]);
  });
});

import { InMemoryMenuRepository } from '../../infrastructure/adapters/persistence/in-memory-menu.repository.js';
import { MenuItem } from '../../domain/menu-item.entity.js';
import {
  MenuItemNotFoundError,
  MenuParentNotGroupError,
  MenuReorderDuplicateError,
  MenuReorderSelfParentError,
  NestedMenuGroupError,
} from '../../domain/menu-item.errors.js';
import { ReorderMenuItemsUseCase } from './reorder-menu-items.use-case.js';

describe('ReorderMenuItemsUseCase', () => {
  let repository: InMemoryMenuRepository;
  let useCase: ReorderMenuItemsUseCase;

  let group: MenuItem;
  let otherGroup: MenuItem;
  let patients: MenuItem;
  let users: MenuItem;
  let roles: MenuItem;

  beforeEach(async () => {
    repository = new InMemoryMenuRepository();
    useCase = new ReorderMenuItemsUseCase(repository);

    group = MenuItem.create({ kind: 'group', label: 'Admin' });
    otherGroup = MenuItem.create({ kind: 'group', label: 'Cuenta' });
    patients = MenuItem.create({ kind: 'item', routeKey: 'patients' });
    users = MenuItem.create({ kind: 'item', routeKey: 'users' });
    roles = MenuItem.create({ kind: 'item', routeKey: 'admin.roles', parentId: group.id });

    patients.setPosition(0);
    users.setPosition(1);
    roles.setPosition(0);
    group.setPosition(2);
    otherGroup.setPosition(3);

    for (const item of [group, otherGroup, patients, users, roles]) {
      await repository.save(item);
    }
  });

  it('moves entries and re-numbers every sibling list 0..n', async () => {
    const tree = await useCase.execute({
      updates: [
        { id: users.id, parentId: null, position: 0 },
        { id: patients.id, parentId: null, position: 1 },
        { id: roles.id, parentId: group.id, position: 5 },
      ],
      actorId: 'admin-id',
    });

    // Roots sorted by the new positions, ties broken by insertion order.
    expect(tree.map((node) => node.item.label ?? node.item.routeKey)).toEqual([
      'users',
      'patients',
      'Admin',
      'Cuenta',
    ]);
    expect(tree.map((node) => node.item.position)).toEqual([0, 1, 2, 3]);

    const adminNode = tree.find((node) => node.item.label === 'Admin')!;
    expect(adminNode.children.map((child) => child.item.routeKey)).toEqual(['admin.roles']);
    expect(adminNode.children[0]!.item.position).toBe(0);
    expect(roles.updatedBy).toBe('admin-id');
  });

  it('re-parents entries into a group', async () => {
    const tree = await useCase.execute({
      updates: [{ id: users.id, parentId: group.id, position: 1 }],
    });

    const adminNode = tree.find((node) => node.item.label === 'Admin')!;
    expect(adminNode.children.map((child) => child.item.routeKey)).toEqual(['admin.roles', 'users']);
    expect(adminNode.children.map((child) => child.item.position)).toEqual([0, 1]);
    expect(tree.some((node) => node.item.routeKey === 'users')).toBe(false);
  });

  it('rejects unknown ids, duplicates, bad parents and nested groups', async () => {
    await expect(
      useCase.execute({ updates: [{ id: 'missing', parentId: null, position: 0 }] }),
    ).rejects.toThrow(MenuItemNotFoundError);

    await expect(
      useCase.execute({
        updates: [
          { id: patients.id, parentId: null, position: 0 },
          { id: patients.id, parentId: null, position: 1 },
        ],
      }),
    ).rejects.toThrow(MenuReorderDuplicateError);

    await expect(
      useCase.execute({ updates: [{ id: patients.id, parentId: roles.id, position: 0 }] }),
    ).rejects.toThrow(MenuParentNotGroupError);

    await expect(
      useCase.execute({ updates: [{ id: patients.id, parentId: patients.id, position: 0 }] }),
    ).rejects.toThrow(MenuReorderSelfParentError);

    await expect(
      useCase.execute({ updates: [{ id: group.id, parentId: otherGroup.id, position: 0 }] }),
    ).rejects.toThrow(NestedMenuGroupError);
  });
});

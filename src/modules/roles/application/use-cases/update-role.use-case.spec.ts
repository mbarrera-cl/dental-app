import { ADMIN_CRITICAL_PERMISSIONS, allPermissionKeys } from '../../../../shared/security/permissions.js';
import { Role } from '../../domain/role.entity.js';
import {
  EmptyRoleUpdateError,
  RoleNameReservedError,
  RoleNameTakenError,
  RoleNotFoundError,
  RoleProtectedError,
} from '../../domain/role.errors.js';
import { InMemoryRoleRepository } from '../../infrastructure/adapters/persistence/in-memory-role.repository.js';
import { UpdateRoleUseCase } from './update-role.use-case.js';

describe('UpdateRoleUseCase', () => {
  const setup = async () => {
    const roleRepository = new InMemoryRoleRepository();
    const adminRole = Role.create({
      name: 'admin',
      description: 'Built-in administrator',
      permissions: [...allPermissionKeys()],
      builtIn: true,
    });
    const supportRole = Role.create({ name: 'Support', permissions: ['users:read'] });
    await roleRepository.save(adminRole);
    await roleRepository.save(supportRole);

    return { roleRepository, useCase: new UpdateRoleUseCase(roleRepository), adminRole, supportRole };
  };

  it('updates description and permissions of a regular role', async () => {
    const { useCase, supportRole } = await setup();

    const updated = await useCase.execute({
      id: supportRole.id,
      description: 'Second level',
      permissions: ['users:read', 'users:update'],
    });

    expect(updated.role.description).toBe('Second level');
    expect(updated.role.permissions).toEqual(['users:read', 'users:update']);
  });

  it('rejects empty updates', async () => {
    const { useCase, supportRole } = await setup();

    await expect(useCase.execute({ id: supportRole.id })).rejects.toThrow(EmptyRoleUpdateError);
  });

  it('rejects renaming the protected admin role', async () => {
    const { useCase, adminRole } = await setup();

    await expect(
      useCase.execute({ id: adminRole.id, name: 'superadmin' }),
    ).rejects.toThrow(RoleProtectedError);
  });

  it('allows sending the unchanged name of the protected role', async () => {
    const { useCase, adminRole } = await setup();

    const updated = await useCase.execute({ id: adminRole.id, name: 'admin' });

    expect(updated.role.name).toBe('admin');
  });

  it('rejects stripping critical permissions from the protected role', async () => {
    const { useCase, adminRole } = await setup();
    const withoutCritical = allPermissionKeys().filter((key) => key !== ADMIN_CRITICAL_PERMISSIONS[0]);

    await expect(
      useCase.execute({ id: adminRole.id, permissions: [...withoutCritical] }),
    ).rejects.toThrow(RoleProtectedError);

    const kept = await useCase.execute({ id: adminRole.id, permissions: [...allPermissionKeys()] });
    expect(kept.role.permissions).toHaveLength(allPermissionKeys().length);
  });

  it('rejects renaming to a reserved or already taken name', async () => {
    const { roleRepository, useCase, supportRole } = await setup();
    const other = Role.create({ name: 'Billing', permissions: [] });
    await roleRepository.save(other);

    await expect(useCase.execute({ id: supportRole.id, name: 'ADMIN' })).rejects.toThrow(
      RoleNameReservedError,
    );

    await expect(useCase.execute({ id: supportRole.id, name: 'billing' })).rejects.toThrow(
      RoleNameTakenError,
    );
  });

  it('reports missing roles', async () => {
    const { useCase } = await setup();

    await expect(useCase.execute({ id: 'ghost', name: 'Nope' })).rejects.toThrow(RoleNotFoundError);
  });

  it('returns the usage count of the updated role', async () => {
    const { useCase, supportRole, roleRepository } = await setup();
    roleRepository.setUserCount(supportRole.id, 3);

    const updated = await useCase.execute({ id: supportRole.id, description: 'x' });

    expect(updated.userCount).toBe(3);
  });

  it('renaming a role to its own name is a no-op', async () => {
    const { useCase, supportRole } = await setup();

    const updated = await useCase.execute({ id: supportRole.id, name: 'Support' });

    expect(updated.role.name).toBe('Support');
  });
});

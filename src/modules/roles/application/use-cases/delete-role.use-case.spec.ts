import { Role } from '../../domain/role.entity.js';
import { RoleAssignedError, RoleNotFoundError, RoleProtectedError } from '../../domain/role.errors.js';
import { InMemoryRoleRepository } from '../../infrastructure/adapters/persistence/in-memory-role.repository.js';
import { DeleteRoleUseCase } from './delete-role.use-case.js';

describe('DeleteRoleUseCase', () => {
  const setup = async () => {
    const roleRepository = new InMemoryRoleRepository();
    const adminRole = Role.create({
      name: 'admin',
      permissions: ['users:read'],
      builtIn: true,
    });
    const supportRole = Role.create({ name: 'Support', permissions: ['users:read'] });
    await roleRepository.save(adminRole);
    await roleRepository.save(supportRole);

    return { roleRepository, useCase: new DeleteRoleUseCase(roleRepository), adminRole, supportRole };
  };

  it('deletes an unassigned role', async () => {
    const { roleRepository, useCase, supportRole } = await setup();

    await useCase.execute({ id: supportRole.id });

    await expect(roleRepository.findById(supportRole.id)).resolves.toBeNull();
  });

  it('refuses to delete the protected role', async () => {
    const { useCase, adminRole } = await setup();

    await expect(useCase.execute({ id: adminRole.id })).rejects.toThrow(RoleProtectedError);
  });

  it('refuses to delete a role that is still assigned', async () => {
    const { roleRepository, useCase, supportRole } = await setup();
    roleRepository.setUserCount(supportRole.id, 2);

    await expect(useCase.execute({ id: supportRole.id })).rejects.toMatchObject({
      name: 'RoleAssignedError',
      details: { userCount: 2 },
    });

    await expect(roleRepository.findById(supportRole.id)).resolves.not.toBeNull();
  });

  it('reports missing roles', async () => {
    const { useCase } = await setup();

    await expect(useCase.execute({ id: 'ghost' })).rejects.toThrow(RoleNotFoundError);
  });

  it('deletes an unassigned role even after it was briefly assigned', async () => {
    const { roleRepository, useCase, supportRole } = await setup();

    roleRepository.setUserCount(supportRole.id, 1);
    await expect(useCase.execute({ id: supportRole.id })).rejects.toThrow(RoleAssignedError);

    roleRepository.setUserCount(supportRole.id, 0);
    await expect(useCase.execute({ id: supportRole.id })).resolves.toBeUndefined();
  });
});

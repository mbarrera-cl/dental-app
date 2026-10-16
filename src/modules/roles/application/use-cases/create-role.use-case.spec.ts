import { PermissionUnknownError } from '../../../../shared/security/permission.errors.js';
import { InvalidRoleNameError, RoleNameReservedError, RoleNameTakenError } from '../../domain/role.errors.js';
import { InMemoryRoleRepository } from '../../infrastructure/adapters/persistence/in-memory-role.repository.js';
import { CreateRoleUseCase } from './create-role.use-case.js';

describe('CreateRoleUseCase', () => {
  const setup = () => {
    const roleRepository = new InMemoryRoleRepository();

    return { roleRepository, useCase: new CreateRoleUseCase(roleRepository) };
  };

  it('creates and persists a role', async () => {
    const { roleRepository, useCase } = setup();

    const role = await useCase.execute({
      name: 'Support',
      description: 'First-level support',
      permissions: ['users:read', 'users:update'],
    });

    expect(role.builtIn).toBe(false);
    await expect(roleRepository.findById(role.id)).resolves.toMatchObject({ role });
  });

  it('rejects names reserved for the built-in role', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({ name: 'Admin', permissions: [] }),
    ).rejects.toThrow(RoleNameReservedError);
  });

  it('rejects duplicate names case-insensitively', async () => {
    const { useCase } = setup();
    await useCase.execute({ name: 'Support', permissions: [] });

    await expect(useCase.execute({ name: 'support', permissions: [] })).rejects.toThrow(
      RoleNameTakenError,
    );
  });

  it('rejects unknown permission keys before hitting the repository', async () => {
    const { roleRepository, useCase } = setup();
    const findByName = vi.spyOn(roleRepository, 'findByName');

    await expect(
      useCase.execute({ name: 'Support', permissions: ['users:read', 'nope:do'] }),
    ).rejects.toThrow(PermissionUnknownError);
    expect(findByName).not.toHaveBeenCalled();
  });

  it('rejects invalid names before hitting the repository', async () => {
    const { roleRepository, useCase } = setup();
    const findByName = vi.spyOn(roleRepository, 'findByName');

    await expect(useCase.execute({ name: '!', permissions: [] })).rejects.toThrow(
      InvalidRoleNameError,
    );
    expect(findByName).not.toHaveBeenCalled();
  });
});

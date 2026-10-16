import { PermissionUnknownError } from '../../../../shared/security/permission.errors.js';
import { InMemoryUserRepository } from '../../infrastructure/adapters/persistence/in-memory-user.repository.js';
import { User } from '../../domain/user.entity.js';
import { UserNotFoundError } from '../../domain/user.errors.js';
import { UpdateUserPermissionsUseCase } from './update-user-permissions.use-case.js';

describe('UpdateUserPermissionsUseCase', () => {
  let userRepository: InMemoryUserRepository;
  let useCase: UpdateUserPermissionsUseCase;

  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    useCase = new UpdateUserPermissionsUseCase(userRepository);
  });

  const createUser = async () => {
    const user = User.create({ email: 'ada@example.com', name: 'Ada Lovelace' });
    await userRepository.save(user);

    return user;
  };

  it('replaces the complete set of direct permissions, de-duplicated', async () => {
    const user = await createUser();

    await useCase.execute({
      id: user.id,
      permissions: ['users:read', 'dashboard:read', 'users:read'],
    });

    expect(userRepository.directPermissionsOf(user.id).sort()).toEqual([
      'dashboard:read',
      'users:read',
    ]);

    await useCase.execute({ id: user.id, permissions: [] });
    expect(userRepository.directPermissionsOf(user.id)).toEqual([]);
  });

  it('rejects unknown permission keys without touching the stored grants', async () => {
    const user = await createUser();
    await useCase.execute({ id: user.id, permissions: ['users:read'] });

    await expect(
      useCase.execute({ id: user.id, permissions: ['users:read', 'ghost:read'] }),
    ).rejects.toThrow(PermissionUnknownError);

    expect(userRepository.directPermissionsOf(user.id)).toEqual(['users:read']);
  });

  it('throws UserNotFoundError for unknown ids', async () => {
    await expect(
      useCase.execute({ id: 'does-not-exist', permissions: ['users:read'] }),
    ).rejects.toThrow(UserNotFoundError);
  });
});

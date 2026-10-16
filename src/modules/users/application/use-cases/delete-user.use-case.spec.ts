import { PasswordHasher } from '../../../../shared/security/password-hasher.js';
import { PasswordPolicyService } from '../../../../shared/security/password-policy.js';
import { SettingsRepositoryPort } from '../../../settings/application/ports/settings-repository.port.js';
import { SettingsService } from '../../../settings/application/settings.service.js';
import type { SettingValue } from '../../../settings/domain/setting-definition.js';
import { Role } from '../../../roles/domain/role.entity.js';
import { InMemoryRoleRepository } from '../../../roles/infrastructure/adapters/persistence/in-memory-role.repository.js';
import { InMemoryUserRepository } from '../../infrastructure/adapters/persistence/in-memory-user.repository.js';
import { LastAdminError, UserNotFoundError } from '../../domain/user.errors.js';
import { CreateUserUseCase } from './create-user.use-case.js';
import { DeleteUserUseCase } from './delete-user.use-case.js';

class FakeSettingsRepository extends SettingsRepositoryPort {
  stored: Record<string, SettingValue> = {};

  async findAll(): Promise<Record<string, SettingValue>> {
    return { ...this.stored };
  }

  async saveMany(values: Record<string, SettingValue>): Promise<void> {
    Object.assign(this.stored, values);
  }
}

describe('DeleteUserUseCase', () => {
  let userRepository: InMemoryUserRepository;
  let roles: InMemoryRoleRepository;
  let createUseCase: CreateUserUseCase;
  let useCase: DeleteUserUseCase;
  let adminRole: Role;

  beforeEach(async () => {
    userRepository = new InMemoryUserRepository();
    roles = new InMemoryRoleRepository();
    adminRole = Role.create({ name: 'admin', permissions: ['users:read'], builtIn: true });
    await roles.save(adminRole);
    userRepository.adminRoleId = adminRole.id;

    createUseCase = new CreateUserUseCase(
      userRepository,
      roles,
      new PasswordHasher(),
      new PasswordPolicyService(new SettingsService(new FakeSettingsRepository())),
    );
    useCase = new DeleteUserUseCase(userRepository);
  });

  const makeActiveAdmin = async (email: string) => {
    const admin = await createUseCase.execute({
      email,
      name: 'Admin',
      password: 'Str0ng-Passw0rd!',
    });
    await userRepository.setRoles(admin.id, [adminRole.id]);

    return admin;
  };

  it('deletes an existing user', async () => {
    const user = await createUseCase.execute({
      email: 'ada@example.com',
      name: 'Ada Lovelace',
    });

    await useCase.execute({ id: user.id });

    await expect(userRepository.findById(user.id)).resolves.toBeNull();
  });

  it('throws UserNotFoundError for unknown ids', async () => {
    await expect(useCase.execute({ id: 'does-not-exist' })).rejects.toThrow(UserNotFoundError);
  });

  it('refuses to delete the last active administrator', async () => {
    const admin = await makeActiveAdmin('first@example.com');

    await expect(useCase.execute({ id: admin.id })).rejects.toThrow(LastAdminError);
    await expect(userRepository.findById(admin.id)).resolves.toBeDefined();
  });

  it('deletes an administrator when another one remains', async () => {
    const first = await makeActiveAdmin('first@example.com');
    await makeActiveAdmin('second@example.com');

    await useCase.execute({ id: first.id });

    await expect(userRepository.findById(first.id)).resolves.toBeNull();
  });

  it('deletes users holding the admin role but unable to log in', async () => {
    // Without credentials the account cannot administer anything, so it does
    // not count as an active administrator.
    const user = await createUseCase.execute({ email: 'ada@example.com', name: 'Ada Lovelace' });
    await userRepository.setRoles(user.id, [adminRole.id]);

    await useCase.execute({ id: user.id });

    await expect(userRepository.findById(user.id)).resolves.toBeNull();
  });
});

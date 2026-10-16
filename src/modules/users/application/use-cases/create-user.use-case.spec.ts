import { PasswordHasher } from '../../../../shared/security/password-hasher.js';
import { PasswordPolicyService } from '../../../../shared/security/password-policy.js';
import { PasswordPolicyViolationError } from '../../../../shared/security/password.errors.js';
import { SettingsRepositoryPort } from '../../../settings/application/ports/settings-repository.port.js';
import { SettingsService } from '../../../settings/application/settings.service.js';
import type { SettingValue } from '../../../settings/domain/setting-definition.js';
import { Role } from '../../../roles/domain/role.entity.js';
import { InMemoryRoleRepository } from '../../../roles/infrastructure/adapters/persistence/in-memory-role.repository.js';
import { InMemoryUserRepository } from '../../infrastructure/adapters/persistence/in-memory-user.repository.js';
import {
  InvalidEmailError,
  UnknownRoleError,
  UserAlreadyExistsError,
} from '../../domain/user.errors.js';
import { CreateUserUseCase } from './create-user.use-case.js';

class FakeSettingsRepository extends SettingsRepositoryPort {
  stored: Record<string, SettingValue> = {};

  async findAll(): Promise<Record<string, SettingValue>> {
    return { ...this.stored };
  }

  async saveMany(values: Record<string, SettingValue>): Promise<void> {
    Object.assign(this.stored, values);
  }
}

describe('CreateUserUseCase', () => {
  // Use cases are plain classes: no Nest container is needed to unit test them.
  let userRepository: InMemoryUserRepository;
  let roles: InMemoryRoleRepository;
  let hasher: PasswordHasher;
  let useCase: CreateUserUseCase;

  const setup = () => {
    userRepository = new InMemoryUserRepository();
    roles = new InMemoryRoleRepository();
    hasher = new PasswordHasher();
    useCase = new CreateUserUseCase(
      userRepository,
      roles,
      hasher,
      new PasswordPolicyService(new SettingsService(new FakeSettingsRepository())),
    );

    return { userRepository, roles, useCase };
  };

  beforeEach(setup);

  const editorRole = () => Role.create({ name: 'editor', permissions: ['users:read'] });

  it('creates and persists a user', async () => {
    const user = await useCase.execute({
      email: 'ada@example.com',
      name: 'Ada Lovelace',
    });

    expect(user.id).toEqual(expect.any(String));
    await expect(userRepository.findById(user.id)).resolves.toBe(user);
  });

  it('normalizes the email before storing it', async () => {
    const user = await useCase.execute({
      email: '  Ada@Example.COM ',
      name: 'Ada Lovelace',
    });

    expect(user.email).toBe('ada@example.com');
  });

  it('rejects invalid emails before hitting the repository', async () => {
    const findByEmail = vi.spyOn(userRepository, 'findByEmail');

    await expect(useCase.execute({ email: 'not-an-email', name: 'Ada' })).rejects.toThrow(
      InvalidEmailError,
    );
    expect(findByEmail).not.toHaveBeenCalled();
  });

  it('rejects emails that already exist', async () => {
    await useCase.execute({ email: 'ada@example.com', name: 'Ada Lovelace' });

    await expect(
      useCase.execute({ email: 'ADA@example.com', name: 'Ada Lovelace Again' }),
    ).rejects.toThrow(UserAlreadyExistsError);
  });

  it('stores a hashed initial password that can be verified', async () => {
    const user = await useCase.execute({
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      password: 'Str0ng-Passw0rd!',
    });

    expect(user.hasPassword).toBe(true);
    expect(user.passwordHash).not.toBe('Str0ng-Passw0rd!');
    await expect(hasher.verify('Str0ng-Passw0rd!', user.passwordHash!)).resolves.toBe(true);
    // An admin-chosen password is final: no forced change on first login.
    expect(user.mustChangePassword).toBe(false);
  });

  it('rejects a password that breaks the policy without persisting the user', async () => {
    await expect(
      useCase.execute({ email: 'ada@example.com', name: 'Ada', password: 'short' }),
    ).rejects.toThrow(PasswordPolicyViolationError);

    await expect(userRepository.findAll()).resolves.toEqual([]);
  });

  it('assigns the requested roles to the new user', async () => {
    const editor = editorRole();
    await roles.save(editor);

    const user = await useCase.execute({
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      roles: [editor.id, editor.id],
    });

    expect(userRepository.roleIdsOf(user.id)).toEqual([editor.id]);
  });

  it('rejects unknown role ids without persisting the user', async () => {
    await expect(
      useCase.execute({ email: 'ada@example.com', name: 'Ada', roles: ['ghost-role'] }),
    ).rejects.toThrow(UnknownRoleError);

    await expect(userRepository.findAll()).resolves.toEqual([]);
  });

  it('creates disabled users on request', async () => {
    const user = await useCase.execute({
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      status: 'disabled',
    });

    expect(user.status).toBe('disabled');
  });
});

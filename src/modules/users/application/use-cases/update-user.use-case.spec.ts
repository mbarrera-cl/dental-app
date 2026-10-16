import { PasswordHasher } from '../../../../shared/security/password-hasher.js';
import { PasswordPolicyService } from '../../../../shared/security/password-policy.js';
import { SettingsRepositoryPort } from '../../../settings/application/ports/settings-repository.port.js';
import { SettingsService } from '../../../settings/application/settings.service.js';
import type { SettingValue } from '../../../settings/domain/setting-definition.js';
import { Role } from '../../../roles/domain/role.entity.js';
import { InMemoryRoleRepository } from '../../../roles/infrastructure/adapters/persistence/in-memory-role.repository.js';
import { InMemoryUserRepository } from '../../infrastructure/adapters/persistence/in-memory-user.repository.js';
import {
  EmptyUserUpdateError,
  LastAdminError,
  UnknownRoleError,
  UserAlreadyExistsError,
  UserNotFoundError,
} from '../../domain/user.errors.js';
import { CreateUserUseCase } from './create-user.use-case.js';
import { UpdateUserUseCase } from './update-user.use-case.js';

class FakeSettingsRepository extends SettingsRepositoryPort {
  stored: Record<string, SettingValue> = {};

  async findAll(): Promise<Record<string, SettingValue>> {
    return { ...this.stored };
  }

  async saveMany(values: Record<string, SettingValue>): Promise<void> {
    Object.assign(this.stored, values);
  }
}

describe('UpdateUserUseCase', () => {
  let userRepository: InMemoryUserRepository;
  let roles: InMemoryRoleRepository;
  let createUseCase: CreateUserUseCase;
  let useCase: UpdateUserUseCase;
  let adminRole: Role;

  const setup = async () => {
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

    const user = await createUseCase.execute({ email: 'ada@example.com', name: 'Ada Lovelace' });
    useCase = new UpdateUserUseCase(userRepository, roles);

    return { userRepository, user, useCase };
  };

  /** A user that counts as "active administrator" (password + admin role). */
  const makeActiveAdmin = async (email: string) => {
    const admin = await createUseCase.execute({
      email,
      name: 'Admin',
      password: 'Str0ng-Passw0rd!',
    });
    await userRepository.setRoles(admin.id, [adminRole.id]);

    return admin;
  };

  it('updates name and email and persists the change', async () => {
    const { userRepository, user, useCase } = await setup();

    const updated = await useCase.execute({
      id: user.id,
      name: 'Ada King',
      email: 'Ada.King@Example.com',
    });

    expect(updated.name).toBe('Ada King');
    expect(updated.email).toBe('ada.king@example.com');
    await expect(userRepository.findById(user.id)).resolves.toBe(updated);
  });

  it('updates only the provided fields', async () => {
    const { user, useCase } = await setup();

    const updated = await useCase.execute({ id: user.id, name: 'Ada King' });

    expect(updated.name).toBe('Ada King');
    expect(updated.email).toBe('ada@example.com');
  });

  it('keeps the current email when it is re-submitted', async () => {
    const { user, useCase } = await setup();

    await expect(useCase.execute({ id: user.id, email: 'ADA@example.com' })).resolves.toBeDefined();
  });

  it('rejects emails already used by another user', async () => {
    const { user, useCase } = await setup();
    await createUseCase.execute({
      email: 'grace@example.com',
      name: 'Grace Hopper',
    });

    await expect(useCase.execute({ id: user.id, email: 'GRACE@example.com' })).rejects.toThrow(
      UserAlreadyExistsError,
    );
  });

  it('throws EmptyUserUpdateError when no field is provided', async () => {
    const { user, useCase } = await setup();

    await expect(useCase.execute({ id: user.id })).rejects.toThrow(EmptyUserUpdateError);
  });

  it('throws UserNotFoundError for unknown ids', async () => {
    const { useCase } = await setup();

    await expect(useCase.execute({ id: 'does-not-exist', name: 'Ghost' })).rejects.toThrow(
      UserNotFoundError,
    );
  });

  it('replaces the complete set of roles', async () => {
    const { userRepository, user, useCase } = await setup();
    const editor = Role.create({ name: 'editor', permissions: ['users:read'] });
    await roles.save(editor);

    await useCase.execute({ id: user.id, roles: [editor.id] });
    expect(userRepository.roleIdsOf(user.id)).toEqual([editor.id]);

    await useCase.execute({ id: user.id, roles: [] });
    expect(userRepository.roleIdsOf(user.id)).toEqual([]);
  });

  it('rejects unknown role ids', async () => {
    const { user, useCase } = await setup();

    await expect(useCase.execute({ id: user.id, roles: ['ghost-role'] })).rejects.toThrow(
      UnknownRoleError,
    );
  });

  it('disables and re-enables a regular user', async () => {
    const { user, useCase } = await setup();

    const disabled = await useCase.execute({ id: user.id, status: 'disabled' });
    expect(disabled.status).toBe('disabled');

    const enabled = await useCase.execute({ id: user.id, status: 'active' });
    expect(enabled.status).toBe('active');
  });

  it('strips the admin role when another administrator remains', async () => {
    const { userRepository, useCase } = await setup();
    const first = await makeActiveAdmin('first@example.com');
    await makeActiveAdmin('second@example.com');
    const editor = Role.create({ name: 'editor', permissions: ['users:read'] });
    await roles.save(editor);

    await useCase.execute({ id: first.id, roles: [editor.id] });

    expect(userRepository.roleIdsOf(first.id)).toEqual([editor.id]);
  });

  it('refuses to strip the admin role from the last administrator', async () => {
    const { userRepository, useCase } = await setup();
    const admin = await makeActiveAdmin('first@example.com');
    const editor = Role.create({ name: 'editor', permissions: ['users:read'] });
    await roles.save(editor);

    await expect(useCase.execute({ id: admin.id, roles: [editor.id] })).rejects.toThrow(
      LastAdminError,
    );
    expect(userRepository.roleIdsOf(admin.id)).toEqual([adminRole.id]);
  });

  it('refuses to disable the last administrator', async () => {
    const { useCase } = await setup();
    const admin = await makeActiveAdmin('first@example.com');

    await expect(useCase.execute({ id: admin.id, status: 'disabled' })).rejects.toThrow(
      LastAdminError,
    );
    await expect(useCase.execute({ id: admin.id, status: 'disabled' })).rejects.toThrow(
      /cannot be disabled/,
    );
  });

  it('allows disabling an administrator when another one remains', async () => {
    const { userRepository, useCase } = await setup();
    const first = await makeActiveAdmin('first@example.com');
    await makeActiveAdmin('second@example.com');

    await useCase.execute({ id: first.id, status: 'disabled' });

    await expect(userRepository.findById(first.id)).resolves.toMatchObject({
      status: 'disabled',
    });
  });

  it('allows changes that keep the admin role (e.g. renaming the last administrator)', async () => {
    const { useCase } = await setup();
    const admin = await makeActiveAdmin('first@example.com');

    const updated = await useCase.execute({
      id: admin.id,
      name: 'Renamed Admin',
      roles: [adminRole.id],
    });

    expect(updated.name).toBe('Renamed Admin');
  });
});

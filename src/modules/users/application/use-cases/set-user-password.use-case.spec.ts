import { PasswordHasher } from '../../../../shared/security/password-hasher.js';
import { PasswordPolicyService } from '../../../../shared/security/password-policy.js';
import {
  PasswordPolicyViolationError,
  PasswordReusedError,
} from '../../../../shared/security/password.errors.js';
import { SettingsRepositoryPort } from '../../../settings/application/ports/settings-repository.port.js';
import { SettingsService } from '../../../settings/application/settings.service.js';
import type { SettingValue } from '../../../settings/domain/setting-definition.js';
import { InMemoryRoleRepository } from '../../../roles/infrastructure/adapters/persistence/in-memory-role.repository.js';
import { InMemoryUserRepository } from '../../infrastructure/adapters/persistence/in-memory-user.repository.js';
import { PasswordHistoryPort } from '../ports/password-history.port.js';
import { EmptyPasswordResetError, UserNotFoundError } from '../../domain/user.errors.js';
import { CreateUserUseCase } from './create-user.use-case.js';
import { SetUserPasswordUseCase } from './set-user-password.use-case.js';

class FakeSettingsRepository extends SettingsRepositoryPort {
  stored: Record<string, SettingValue> = {};

  async findAll(): Promise<Record<string, SettingValue>> {
    return { ...this.stored };
  }

  async saveMany(values: Record<string, SettingValue>): Promise<void> {
    Object.assign(this.stored, values);
  }
}

class FakePasswordHistory extends PasswordHistoryPort {
  private readonly entries = new Map<string, string[]>();

  async listRecent(userId: string, limit: number): Promise<string[]> {
    return (this.entries.get(userId) ?? []).slice(0, limit);
  }

  async append(userId: string, passwordHash: string): Promise<void> {
    this.entries.set(userId, [passwordHash, ...(this.entries.get(userId) ?? [])]);
  }

  async trim(userId: string, keep: number): Promise<void> {
    this.entries.set(userId, (this.entries.get(userId) ?? []).slice(0, keep));
  }
}

const INITIAL = 'Str0ng-Passw0rd!';

describe('SetUserPasswordUseCase', () => {
  let userRepository: InMemoryUserRepository;
  let hasher: PasswordHasher;
  let policy: PasswordPolicyService;
  let history: FakePasswordHistory;
  let useCase: SetUserPasswordUseCase;

  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    hasher = new PasswordHasher();
    const settings = new SettingsService(new FakeSettingsRepository());
    policy = new PasswordPolicyService(settings);
    history = new FakePasswordHistory();
    useCase = new SetUserPasswordUseCase(userRepository, hasher, policy, settings, history);
  });

  const createUser = (email = 'ada@example.com') =>
    new CreateUserUseCase(
      userRepository,
      new InMemoryRoleRepository(),
      hasher,
      policy,
    ).execute({ email, name: 'Ada Lovelace', password: INITIAL });

  it('stores a typed password and forces a change on next login', async () => {
    const user = await createUser();

    const result = await useCase.execute({ id: user.id, password: 'Nueva-Str0ng-456!' });

    expect(result.password).toBeNull();
    const reloaded = (await userRepository.findById(user.id))!;
    expect(reloaded.mustChangePassword).toBe(true);
    await expect(hasher.verify('Nueva-Str0ng-456!', reloaded.passwordHash!)).resolves.toBe(true);
  });

  it('unlocks the account as part of the reset', async () => {
    const user = await createUser();
    user.registerFailedLogin();
    user.lockUntil(new Date(Date.now() + 60_000));
    await userRepository.update(user);

    await useCase.execute({ id: user.id, password: 'Nueva-Str0ng-456!' });

    const reloaded = (await userRepository.findById(user.id))!;
    expect(reloaded.lockedUntil).toBeNull();
    expect(reloaded.failedLoginAttempts).toBe(0);
  });

  it('keeps the replaced hash in the history', async () => {
    const user = await createUser();

    await useCase.execute({ id: user.id, password: 'Nueva-Str0ng-456!' });

    const recent = await history.listRecent(user.id, 3);
    expect(recent).toHaveLength(1);
    await expect(hasher.verify(INITIAL, recent[0])).resolves.toBe(true);
  });

  it('rejects a typed password that breaks the policy', async () => {
    const user = await createUser();
    const before = user.passwordHash;

    await expect(useCase.execute({ id: user.id, password: 'short' })).rejects.toThrow(
      PasswordPolicyViolationError,
    );

    const reloaded = (await userRepository.findById(user.id))!;
    expect(reloaded.passwordHash).toBe(before);
  });

  it('rejects the current password and anything in the history', async () => {
    const user = await createUser();

    await expect(useCase.execute({ id: user.id, password: INITIAL })).rejects.toThrow(
      PasswordReusedError,
    );

    await useCase.execute({ id: user.id, password: 'Nueva-Str0ng-456!' });

    await expect(useCase.execute({ id: user.id, password: INITIAL })).rejects.toThrow(
      PasswordReusedError,
    );
  });

  it('generates a policy-compliant password and returns it exactly once', async () => {
    const user = await createUser();

    const result = await useCase.execute({ id: user.id, generate: true });

    expect(result.password).toEqual(expect.any(String));
    await expect(policy.validate(result.password!)).resolves.toEqual([]);

    const reloaded = (await userRepository.findById(user.id))!;
    expect(reloaded.mustChangePassword).toBe(true);
    await expect(hasher.verify(result.password!, reloaded.passwordHash!)).resolves.toBe(true);
  });

  it('fails when neither a password nor generate is provided', async () => {
    const user = await createUser();

    await expect(useCase.execute({ id: user.id })).rejects.toThrow(EmptyPasswordResetError);
  });

  it('throws UserNotFoundError for unknown ids', async () => {
    await expect(
      useCase.execute({ id: 'does-not-exist', password: 'Nueva-Str0ng-456!' }),
    ).rejects.toThrow(UserNotFoundError);
  });
});

import { SqliteDatabase } from '../../../../shared/infrastructure/database/sqlite-database.js';
import { JwtService } from '../../../../shared/security/jwt.js';
import { PasswordHasher } from '../../../../shared/security/password-hasher.js';
import { PasswordPolicyService } from '../../../../shared/security/password-policy.js';
import {
  PasswordPolicyViolationError,
  PasswordReusedError,
} from '../../../../shared/security/password.errors.js';
import { PermissionResolver } from '../../../../shared/security/permission-resolver.js';
import { SettingsService } from '../../../settings/application/settings.service.js';
import { SqliteSettingsRepository } from '../../../settings/infrastructure/adapters/persistence/sqlite-settings.repository.js';
import { User } from '../../../users/domain/user.entity.js';
import { SqlitePasswordHistoryRepository } from '../../../users/infrastructure/adapters/persistence/sqlite-password-history.repository.js';
import { SqliteUserAccessReader } from '../../../users/infrastructure/adapters/persistence/sqlite-user-access.reader.js';
import { SqliteUserRepository } from '../../../users/infrastructure/adapters/persistence/sqlite-user.repository.js';
import { InvalidCredentialsError } from '../../domain/auth.errors.js';
import { SqliteRefreshTokenRepository } from '../../infrastructure/adapters/persistence/sqlite-refresh-token.repository.js';
import { LoginAttemptsService } from '../login-attempts.service.js';
import { PasswordChangeService } from '../password-change.service.js';
import { SessionService } from '../session.service.js';
import { ChangePasswordUseCase } from './change-password.use-case.js';

describe('ChangePasswordUseCase', () => {
  let database: SqliteDatabase;
  let users: SqliteUserRepository;
  let hasher: PasswordHasher;
  let session: SessionService;
  let useCase: ChangePasswordUseCase;
  let userId: string;

  const currentPassword = 'Valid-123!';

  const activeSessions = (): number => {
    const row = database.connection
      .prepare('SELECT COUNT(*) AS count FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL')
      .get(userId) as unknown as { count: number };

    return row.count;
  };

  const execute = (newPassword: string) =>
    useCase.execute({ userId, currentPassword, newPassword });

  beforeEach(async () => {
    database = new SqliteDatabase(':memory:');
    users = new SqliteUserRepository(database);
    hasher = new PasswordHasher();

    const settings = new SettingsService(new SqliteSettingsRepository(database));
    const refreshTokens = new SqliteRefreshTokenRepository(database);
    const resolver = new PermissionResolver(new SqliteUserAccessReader(database));
    session = new SessionService(new JwtService(), settings, refreshTokens, resolver);

    const passwordChange = new PasswordChangeService(
      users,
      hasher,
      new PasswordPolicyService(settings),
      settings,
      new SqlitePasswordHistoryRepository(database),
    );

    useCase = new ChangePasswordUseCase(
      users,
      hasher,
      new LoginAttemptsService(users, settings),
      passwordChange,
      refreshTokens,
      session,
    );

    const user = User.create({
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      passwordHash: await hasher.hash(currentPassword),
    });
    userId = user.id;
    await users.save(user);
  });

  afterEach(() => {
    database.onModuleDestroy();
  });

  it('rejects a wrong current password and counts the failure', async () => {
    await expect(
      useCase.execute({ userId, currentPassword: 'wrong-current', newPassword: 'New-456-Valid!' }),
    ).rejects.toThrow(InvalidCredentialsError);

    const stored = await users.findById(userId);
    expect(stored?.failedLoginAttempts).toBe(1);
  });

  it('enforces the configurable policy on the new password', async () => {
    const error: unknown = await execute('short').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(PasswordPolicyViolationError);
    expect((error as PasswordPolicyViolationError).details).toMatchObject({
      violations: expect.arrayContaining([expect.objectContaining({ rule: 'minLength' })]),
    });
  });

  it('refuses to reuse the current password', async () => {
    await expect(execute(currentPassword)).rejects.toThrow(PasswordReusedError);
  });

  it('remembers replaced passwords so they cannot come back', async () => {
    await execute('First-New-456!');

    // Going back to the original is blocked by the history check.
    await expect(
      useCase.execute({
        userId,
        currentPassword: 'First-New-456!',
        newPassword: currentPassword,
      }),
    ).rejects.toThrow(PasswordReusedError);

    // A brand-new password is accepted; the previous one stays blocked.
    await useCase.execute({
      userId,
      currentPassword: 'First-New-456!',
      newPassword: 'Second-New-789!',
    });

    await expect(
      useCase.execute({
        userId,
        currentPassword: 'Second-New-789!',
        newPassword: 'First-New-456!',
      }),
    ).rejects.toThrow(PasswordReusedError);
  });

  it('changes the password, records the history and keeps exactly one live session', async () => {
    const user = await users.findById(userId);
    await session.issueFor(user!);
    await session.issueFor(user!);
    expect(activeSessions()).toBe(2);

    const result = await execute('New-456-Valid!');

    expect(result.session.accessToken).toEqual(expect.any(String));
    expect(result.profile.user).toMatchObject({ id: userId });

    const updated = await users.findById(userId);
    expect(await hasher.verify('New-456-Valid!', updated!.passwordHash!)).toBe(true);
    expect(updated?.mustChangePassword).toBe(false);
    expect(updated?.failedLoginAttempts).toBe(0);

    // Other sessions are gone; only the freshly issued pair stays active.
    expect(activeSessions()).toBe(1);

    const history = database.connection
      .prepare('SELECT password_hash FROM password_history WHERE user_id = ?')
      .all(userId) as unknown as Array<{ password_hash: string }>;
    expect(history).toHaveLength(1);
    expect(await hasher.verify(currentPassword, history[0]!.password_hash)).toBe(true);
  });
});

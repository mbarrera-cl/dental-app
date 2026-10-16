import { SqliteDatabase } from '../../../../shared/infrastructure/database/sqlite-database.js';
import { JwtService } from '../../../../shared/security/jwt.js';
import { PasswordHasher } from '../../../../shared/security/password-hasher.js';
import { PermissionResolver } from '../../../../shared/security/permission-resolver.js';
import { SettingsService } from '../../../settings/application/settings.service.js';
import { SqliteSettingsRepository } from '../../../settings/infrastructure/adapters/persistence/sqlite-settings.repository.js';
import { User } from '../../../users/domain/user.entity.js';
import { SqliteUserAccessReader } from '../../../users/infrastructure/adapters/persistence/sqlite-user-access.reader.js';
import { SqliteUserRepository } from '../../../users/infrastructure/adapters/persistence/sqlite-user.repository.js';
import {
  AccountDisabledError,
  AccountLockedError,
  InvalidCredentialsError,
  PasswordChangeRequiredError,
} from '../../domain/auth.errors.js';
import { SqliteRefreshTokenRepository } from '../../infrastructure/adapters/persistence/sqlite-refresh-token.repository.js';
import { LoginAttemptsService } from '../login-attempts.service.js';
import { SessionService } from '../session.service.js';
import { LoginUseCase } from './login.use-case.js';

describe('LoginUseCase', () => {
  let database: SqliteDatabase;
  let users: SqliteUserRepository;
  let hasher: PasswordHasher;
  let jwt: JwtService;
  let useCase: LoginUseCase;
  let userId: string;

  const email = 'ada@example.com';
  const password = 'Valid-123!';

  const activeSessions = (): number => {
    const row = database.connection
      .prepare('SELECT COUNT(*) AS count FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL')
      .get(userId) as unknown as { count: number };

    return row.count;
  };

  beforeEach(async () => {
    database = new SqliteDatabase(':memory:');
    users = new SqliteUserRepository(database);
    hasher = new PasswordHasher();
    jwt = new JwtService();

    const settings = new SettingsService(new SqliteSettingsRepository(database));
    const resolver = new PermissionResolver(new SqliteUserAccessReader(database));
    const session = new SessionService(
      jwt,
      settings,
      new SqliteRefreshTokenRepository(database),
      resolver,
    );
    const attempts = new LoginAttemptsService(users, settings);

    useCase = new LoginUseCase(users, hasher, settings, session, attempts);

    const user = User.create({ email, name: 'Ada Lovelace', passwordHash: await hasher.hash(password) });
    userId = user.id;
    await users.save(user);
  });

  afterEach(() => {
    database.onModuleDestroy();
  });

  it('signs in with valid credentials, records the login and stores a refresh token', async () => {
    const result = await useCase.execute({ email: 'ADA@example.com', password });

    expect(result.profile.user).toMatchObject({ id: userId, email, name: 'Ada Lovelace' });
    expect(jwt.verifyAccessToken(result.session.accessToken)?.sub).toBe(userId);

    const stored = await users.findById(userId);
    expect(stored?.lastLoginAt).not.toBeNull();
    expect(stored?.failedLoginAttempts).toBe(0);
    expect(activeSessions()).toBe(1);
  });

  it('rejects unknown emails and users without a password with the same error', async () => {
    await expect(useCase.execute({ email: 'ghost@example.com', password })).rejects.toThrow(
      InvalidCredentialsError,
    );

    const noPassword = User.create({ email: 'nopass@example.com', name: 'No Password' });
    await users.save(noPassword);

    await expect(useCase.execute({ email: 'nopass@example.com', password })).rejects.toThrow(
      InvalidCredentialsError,
    );
  });

  it('counts failures and locks the account at the configured threshold', async () => {
    // Default policy: 5 failed attempts.
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await expect(useCase.execute({ email, password: 'wrong-password' })).rejects.toThrow(
        InvalidCredentialsError,
      );
    }

    await expect(useCase.execute({ email, password: 'wrong-password' })).rejects.toThrow(
      AccountLockedError,
    );

    // Even the right password is rejected while locked.
    await expect(useCase.execute({ email, password })).rejects.toThrow(AccountLockedError);
    expect(activeSessions()).toBe(0);
  });

  it('rejects disabled accounts', async () => {
    const user = await users.findById(userId);
    user?.changeStatus('disabled');
    await users.update(user!);

    await expect(useCase.execute({ email, password })).rejects.toThrow(AccountDisabledError);
  });

  it('demands a password change when the password expired', async () => {
    const user = await users.findById(userId);
    const past = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    user?.setPassword(await hasher.hash(password), { mustChange: false, changedAt: past });
    await users.update(user!);

    const error: unknown = await useCase.execute({ email, password }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(PasswordChangeRequiredError);
    expect((error as PasswordChangeRequiredError).details).toEqual({ reason: 'expired' });
  });

  it('demands a password change after an admin reset', async () => {
    const user = await users.findById(userId);
    user?.setPassword(await hasher.hash(password), { mustChange: true });
    await users.update(user!);

    const error: unknown = await useCase.execute({ email, password }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(PasswordChangeRequiredError);
    expect((error as PasswordChangeRequiredError).details).toEqual({ reason: 'reset' });
  });
});

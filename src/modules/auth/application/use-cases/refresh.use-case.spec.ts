import { randomUUID } from 'node:crypto';
import { SqliteDatabase } from '../../../../shared/infrastructure/database/sqlite-database.js';
import { JwtService } from '../../../../shared/security/jwt.js';
import { PasswordHasher } from '../../../../shared/security/password-hasher.js';
import { PermissionResolver } from '../../../../shared/security/permission-resolver.js';
import { SettingsService } from '../../../settings/application/settings.service.js';
import { SqliteSettingsRepository } from '../../../settings/infrastructure/adapters/persistence/sqlite-settings.repository.js';
import { User } from '../../../users/domain/user.entity.js';
import { SqliteUserAccessReader } from '../../../users/infrastructure/adapters/persistence/sqlite-user-access.reader.js';
import { SqliteUserRepository } from '../../../users/infrastructure/adapters/persistence/sqlite-user.repository.js';
import { InvalidRefreshTokenError } from '../../domain/auth.errors.js';
import { SqliteRefreshTokenRepository } from '../../infrastructure/adapters/persistence/sqlite-refresh-token.repository.js';
import { SessionService, hashRefreshToken, type IssuedSession } from '../session.service.js';
import { REFRESH_GRACE_WINDOW_MS, RefreshUseCase } from './refresh.use-case.js';

describe('RefreshUseCase', () => {
  let database: SqliteDatabase;
  let users: SqliteUserRepository;
  let refreshTokens: SqliteRefreshTokenRepository;
  let session: SessionService;
  let useCase: RefreshUseCase;
  let userId: string;

  const activeSessions = (): number => {
    const row = database.connection
      .prepare('SELECT COUNT(*) AS count FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL')
      .get(userId) as unknown as { count: number };

    return row.count;
  };

  beforeEach(async () => {
    database = new SqliteDatabase(':memory:');
    users = new SqliteUserRepository(database);
    refreshTokens = new SqliteRefreshTokenRepository(database);

    const settings = new SettingsService(new SqliteSettingsRepository(database));
    const resolver = new PermissionResolver(new SqliteUserAccessReader(database));
    session = new SessionService(new JwtService(), settings, refreshTokens, resolver);
    useCase = new RefreshUseCase(refreshTokens, users, session);

    const user = User.create({
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      passwordHash: await new PasswordHasher().hash('Valid-123!'),
    });
    userId = user.id;
    await users.save(user);
  });

  afterEach(() => {
    database.onModuleDestroy();
  });

  it('rotates: revokes the presented token and issues a fresh pair', async () => {
    const user = await users.findById(userId);
    const first = await session.issueFor(user!);

    const rotated = await useCase.execute({ refreshToken: first.refreshToken });

    expect(rotated.session.refreshToken).not.toBe(first.refreshToken);

    const row = database.connection
      .prepare('SELECT revoked_at FROM refresh_tokens WHERE token_hash = ?')
      .get(hashRefreshToken(first.refreshToken)) as unknown as { revoked_at: string | null };
    expect(row.revoked_at).not.toBeNull();

    // The freshly issued token keeps working.
    await expect(
      useCase.execute({ refreshToken: rotated.session.refreshToken }),
    ).resolves.toBeDefined();
  });

  it('tolerates concurrent replays inside the grace window', async () => {
    const user = await users.findById(userId);
    const first: IssuedSession = await session.issueFor(user!);

    await useCase.execute({ refreshToken: first.refreshToken });

    await expect(useCase.execute({ refreshToken: first.refreshToken })).resolves.toBeDefined();
  });

  it('treats replays after the grace window as theft and kills every session', async () => {
    const user = await users.findById(userId);
    const first = await session.issueFor(user!);

    await useCase.execute({ refreshToken: first.refreshToken });
    expect(activeSessions()).toBe(1);

    // Simulate that the rotation happened long ago.
    database.connection
      .prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ?')
      .run(
        new Date(Date.now() - REFRESH_GRACE_WINDOW_MS - 1000).toISOString(),
        hashRefreshToken(first.refreshToken),
      );

    await expect(useCase.execute({ refreshToken: first.refreshToken })).rejects.toThrow(
      InvalidRefreshTokenError,
    );
    expect(activeSessions()).toBe(0);
  });

  it('rejects missing, unknown and expired tokens', async () => {
    await expect(useCase.execute({ refreshToken: null })).rejects.toThrow(InvalidRefreshTokenError);
    await expect(useCase.execute({ refreshToken: '' })).rejects.toThrow(InvalidRefreshTokenError);
    await expect(useCase.execute({ refreshToken: 'not-a-token' })).rejects.toThrow(
      InvalidRefreshTokenError,
    );

    await refreshTokens.save({
      id: randomUUID(),
      userId,
      tokenHash: hashRefreshToken('expired-token'),
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
      createdAt: new Date(Date.now() - 10_000),
    });

    await expect(useCase.execute({ refreshToken: 'expired-token' })).rejects.toThrow(
      InvalidRefreshTokenError,
    );
  });

  it('kills the sessions of a disabled owner', async () => {
    const user = await users.findById(userId);
    const issued = await session.issueFor(user!);

    user?.changeStatus('disabled');
    await users.update(user!);

    await expect(useCase.execute({ refreshToken: issued.refreshToken })).rejects.toThrow(
      InvalidRefreshTokenError,
    );
    expect(activeSessions()).toBe(0);
  });
});

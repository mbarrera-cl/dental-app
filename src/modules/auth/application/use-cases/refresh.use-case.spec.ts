import { randomUUID } from 'node:crypto';
import { PostgresDatabase } from '../../../../shared/infrastructure/database/postgres-database.js';
import { closePostgresTestDatabase, createPostgresTestDatabase } from '../../../../../test/helpers/postgres-test-database.js';
import { JwtService } from '../../../../shared/security/jwt.js';
import { PasswordHasher } from '../../../../shared/security/password-hasher.js';
import { PermissionResolver } from '../../../../shared/security/permission-resolver.js';
import { SettingsService } from '../../../settings/application/settings.service.js';
import { PostgresSettingsRepository } from '../../../settings/infrastructure/adapters/persistence/postgres-settings.repository.js';
import { User } from '../../../users/domain/user.entity.js';
import { PostgresUserAccessReader } from '../../../users/infrastructure/adapters/persistence/postgres-user-access.reader.js';
import { PostgresUserRepository } from '../../../users/infrastructure/adapters/persistence/postgres-user.repository.js';
import { InvalidRefreshTokenError } from '../../domain/auth.errors.js';
import { PostgresRefreshTokenRepository } from '../../infrastructure/adapters/persistence/postgres-refresh-token.repository.js';
import { SessionService, hashRefreshToken, type IssuedSession } from '../session.service.js';
import { REFRESH_GRACE_WINDOW_MS, RefreshUseCase } from './refresh.use-case.js';

describe('RefreshUseCase', () => {
  let database: PostgresDatabase;
  let users: PostgresUserRepository;
  let refreshTokens: PostgresRefreshTokenRepository;
  let session: SessionService;
  let useCase: RefreshUseCase;
  let userId: string;

  const activeSessions = async (): Promise<number> => {
    const row = await database.queryOne<{ count: string | number }>(
      'SELECT COUNT(*) AS count FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL',
      [userId],
    );

    return Number(row?.count ?? 0);
  };

  beforeEach(async () => {
    database = await createPostgresTestDatabase();
    users = new PostgresUserRepository(database);
    refreshTokens = new PostgresRefreshTokenRepository(database);

    const settings = new SettingsService(new PostgresSettingsRepository(database));
    const resolver = new PermissionResolver(new PostgresUserAccessReader(database));
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

  afterEach(async () => {
    await closePostgresTestDatabase(database);
  });

  it('rotates: revokes the presented token and issues a fresh pair', async () => {
    const user = await users.findById(userId);
    const first = await session.issueFor(user!);

    const rotated = await useCase.execute({ refreshToken: first.refreshToken });

    expect(rotated.session.refreshToken).not.toBe(first.refreshToken);

    const row = await database.queryOne<{ revoked_at: Date | null }>(
      'SELECT revoked_at FROM refresh_tokens WHERE token_hash = $1',
      [hashRefreshToken(first.refreshToken)],
    );
    expect(row?.revoked_at).not.toBeNull();

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
    await expect(activeSessions()).resolves.toBe(1);

    // Simulate that the rotation happened long ago.
    await database.execute(
      'UPDATE refresh_tokens SET revoked_at = $1 WHERE token_hash = $2',
      [
        new Date(Date.now() - REFRESH_GRACE_WINDOW_MS - 1000),
        hashRefreshToken(first.refreshToken),
      ],
    );

    await expect(useCase.execute({ refreshToken: first.refreshToken })).rejects.toThrow(
      InvalidRefreshTokenError,
    );
    await expect(activeSessions()).resolves.toBe(0);
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
    await expect(activeSessions()).resolves.toBe(0);
  });
});

import { SqliteDatabase } from '../../../../../shared/infrastructure/database/sqlite-database.js';
import { User } from '../../../domain/user.entity.js';
import { UserAlreadyExistsError, UserNotFoundError } from '../../../domain/user.errors.js';
import { SqliteUserRepository } from './sqlite-user.repository.js';

describe('SqliteUserRepository', () => {
  let database: SqliteDatabase;
  let repository: SqliteUserRepository;

  beforeEach(() => {
    database = new SqliteDatabase(':memory:');
    repository = new SqliteUserRepository(database);
  });

  afterEach(() => {
    database.onModuleDestroy();
  });

  const makeUser = (email = 'ada@example.com', name = 'Ada Lovelace') =>
    User.create({ email, name });

  it('saves a user and reconstitutes it from the database', async () => {
    const user = makeUser();

    await repository.save(user);
    const found = await repository.findById(user.id);

    expect(found).not.toBeNull();
    expect(found?.id).toBe(user.id);
    expect(found?.email).toBe(user.email);
    expect(found?.name).toBe(user.name);
    expect(found?.createdAt).toEqual(user.createdAt);
  });

  it('translates unique constraint violations into UserAlreadyExistsError', async () => {
    await repository.save(makeUser());

    await expect(repository.save(makeUser('ada@example.com', 'Ada Again'))).rejects.toThrow(
      UserAlreadyExistsError,
    );
  });

  it('updates an existing user', async () => {
    const user = makeUser();
    await repository.save(user);

    user.changeName('Ada King');
    await repository.update(user);

    const found = await repository.findById(user.id);
    expect(found?.name).toBe('Ada King');
  });

  it('throws UserNotFoundError when updating or deleting unknown users', async () => {
    const ghost = makeUser();

    await expect(repository.update(ghost)).rejects.toThrow(UserNotFoundError);
    await expect(repository.delete(ghost.id)).rejects.toThrow(UserNotFoundError);
  });

  it('deletes a user', async () => {
    const user = makeUser();
    await repository.save(user);

    await repository.delete(user.id);

    await expect(repository.findById(user.id)).resolves.toBeNull();
  });

  it('finds by email and lists users in insertion order', async () => {
    const ada = makeUser();
    const grace = makeUser('grace@example.com', 'Grace Hopper');
    await repository.save(ada);
    await repository.save(grace);

    await expect(repository.findByEmail('grace@example.com')).resolves.toMatchObject({
      id: grace.id,
    });

    const all = await repository.findAll();
    expect(all.map((user) => user.id)).toEqual([ada.id, grace.id]);
  });
});

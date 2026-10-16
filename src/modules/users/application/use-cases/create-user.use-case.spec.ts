import { InMemoryUserRepository } from '../../infrastructure/adapters/persistence/in-memory-user.repository.js';
import { InvalidEmailError, UserAlreadyExistsError } from '../../domain/user.errors.js';
import { CreateUserUseCase } from './create-user.use-case.js';

describe('CreateUserUseCase', () => {
  // Use cases are plain classes: no Nest container is needed to unit test them.
  const setup = () => {
    const userRepository = new InMemoryUserRepository();

    return { userRepository, useCase: new CreateUserUseCase(userRepository) };
  };

  it('creates and persists a user', async () => {
    const { userRepository, useCase } = setup();

    const user = await useCase.execute({
      email: 'ada@example.com',
      name: 'Ada Lovelace',
    });

    expect(user.id).toEqual(expect.any(String));
    await expect(userRepository.findById(user.id)).resolves.toBe(user);
  });

  it('normalizes the email before storing it', async () => {
    const { useCase } = setup();

    const user = await useCase.execute({
      email: '  Ada@Example.COM ',
      name: 'Ada Lovelace',
    });

    expect(user.email).toBe('ada@example.com');
  });

  it('rejects invalid emails before hitting the repository', async () => {
    const { userRepository, useCase } = setup();
    const findByEmail = vi.spyOn(userRepository, 'findByEmail');

    await expect(useCase.execute({ email: 'not-an-email', name: 'Ada' })).rejects.toThrow(
      InvalidEmailError,
    );
    expect(findByEmail).not.toHaveBeenCalled();
  });

  it('rejects emails that already exist', async () => {
    const { useCase } = setup();

    await useCase.execute({ email: 'ada@example.com', name: 'Ada Lovelace' });

    await expect(
      useCase.execute({ email: 'ADA@example.com', name: 'Ada Lovelace Again' }),
    ).rejects.toThrow(UserAlreadyExistsError);
  });
});

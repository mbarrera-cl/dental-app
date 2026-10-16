import { InMemoryUserRepository } from '../../infrastructure/adapters/persistence/in-memory-user.repository.js';
import { UserNotFoundError } from '../../domain/user.errors.js';
import { CreateUserUseCase } from './create-user.use-case.js';
import { DeleteUserUseCase } from './delete-user.use-case.js';

describe('DeleteUserUseCase', () => {
  it('deletes an existing user', async () => {
    const userRepository = new InMemoryUserRepository();
    const user = await new CreateUserUseCase(userRepository).execute({
      email: 'ada@example.com',
      name: 'Ada Lovelace',
    });

    await new DeleteUserUseCase(userRepository).execute({ id: user.id });

    await expect(userRepository.findById(user.id)).resolves.toBeNull();
  });

  it('throws UserNotFoundError for unknown ids', async () => {
    const useCase = new DeleteUserUseCase(new InMemoryUserRepository());

    await expect(useCase.execute({ id: 'does-not-exist' })).rejects.toThrow(UserNotFoundError);
  });
});

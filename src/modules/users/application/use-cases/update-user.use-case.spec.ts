import { InMemoryUserRepository } from '../../infrastructure/adapters/persistence/in-memory-user.repository.js';
import {
  EmptyUserUpdateError,
  UserAlreadyExistsError,
  UserNotFoundError,
} from '../../domain/user.errors.js';
import { CreateUserUseCase } from './create-user.use-case.js';
import { UpdateUserUseCase } from './update-user.use-case.js';

describe('UpdateUserUseCase', () => {
  const setup = async () => {
    const userRepository = new InMemoryUserRepository();
    const user = await new CreateUserUseCase(userRepository).execute({
      email: 'ada@example.com',
      name: 'Ada Lovelace',
    });

    return { userRepository, user, useCase: new UpdateUserUseCase(userRepository) };
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
    const { userRepository, user, useCase } = await setup();
    await new CreateUserUseCase(userRepository).execute({
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
});

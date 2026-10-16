import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { User } from '../../domain/user.entity.js';
import { UserAlreadyExistsError } from '../../domain/user.errors.js';
import { UserRepositoryPort } from '../ports/user-repository.port.js';

export interface CreateUserCommand {
  email: string;
  name: string;
}

@Injectable()
export class CreateUserUseCase implements UseCase<CreateUserCommand, User> {
  constructor(private readonly userRepository: UserRepositoryPort) {}

  async execute(command: CreateUserCommand): Promise<User> {
    // Build the entity first so domain invariants (email format, name) are
    // validated before the repository is touched.
    const user = User.create(command);

    const existing = await this.userRepository.findByEmail(user.email);

    if (existing !== null) {
      throw new UserAlreadyExistsError(user.email);
    }

    // Note: this check-then-save flow is illustrative. With a real database,
    // enforce uniqueness with a unique constraint and translate the driver
    // error to a `UserAlreadyExistsError` in the adapter instead.
    await this.userRepository.save(user);

    return user;
  }
}

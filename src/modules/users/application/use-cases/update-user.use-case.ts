import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { Email } from '../../domain/email.vo.js';
import type { User } from '../../domain/user.entity.js';
import {
  EmptyUserUpdateError,
  UserAlreadyExistsError,
  UserNotFoundError,
} from '../../domain/user.errors.js';
import { UserRepositoryPort } from '../ports/user-repository.port.js';

export interface UpdateUserCommand {
  id: string;
  name?: string;
  email?: string;
}

@Injectable()
export class UpdateUserUseCase implements UseCase<UpdateUserCommand, User> {
  constructor(private readonly userRepository: UserRepositoryPort) {}

  async execute({ id, name, email }: UpdateUserCommand): Promise<User> {
    const user = await this.userRepository.findById(id);

    if (user === null) {
      throw new UserNotFoundError(id);
    }

    if (name === undefined && email === undefined) {
      throw new EmptyUserUpdateError();
    }

    if (email !== undefined) {
      // Validate and normalize up front so the duplicate check runs on the
      // normalized value — and before the aggregate is mutated.
      const nextEmail = Email.create(email);
      const existing = await this.userRepository.findByEmail(nextEmail.value);

      if (existing !== null && existing.id !== user.id) {
        throw new UserAlreadyExistsError(nextEmail.value);
      }

      user.changeEmail(nextEmail);
    }

    if (name !== undefined) {
      user.changeName(name);
    }

    await this.userRepository.update(user);

    return user;
  }
}

import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { UserNotFoundError } from '../../domain/user.errors.js';
import { UserRepositoryPort } from '../ports/user-repository.port.js';

export interface DeleteUserCommand {
  id: string;
}

@Injectable()
export class DeleteUserUseCase implements UseCase<DeleteUserCommand, void> {
  constructor(private readonly userRepository: UserRepositoryPort) {}

  async execute({ id }: DeleteUserCommand): Promise<void> {
    const user = await this.userRepository.findById(id);

    if (user === null) {
      throw new UserNotFoundError(id);
    }

    await this.userRepository.delete(id);
  }
}

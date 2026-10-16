import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import type { User } from '../../domain/user.entity.js';
import { UserNotFoundError } from '../../domain/user.errors.js';
import { UserRepositoryPort } from '../ports/user-repository.port.js';

export interface GetUserQuery {
  id: string;
}

@Injectable()
export class GetUserUseCase implements UseCase<GetUserQuery, User> {
  constructor(private readonly userRepository: UserRepositoryPort) {}

  async execute({ id }: GetUserQuery): Promise<User> {
    const user = await this.userRepository.findById(id);

    if (user === null) {
      throw new UserNotFoundError(id);
    }

    return user;
  }
}

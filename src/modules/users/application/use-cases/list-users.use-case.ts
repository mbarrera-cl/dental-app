import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import type { User } from '../../domain/user.entity.js';
import { UserRepositoryPort } from '../ports/user-repository.port.js';

@Injectable()
export class ListUsersUseCase implements UseCase<void, User[]> {
  constructor(private readonly userRepository: UserRepositoryPort) {}

  async execute(): Promise<User[]> {
    return this.userRepository.findAll();
  }
}

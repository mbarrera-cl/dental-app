import { Injectable } from '@nestjs/common';
import { UserRepositoryPort } from '../../../application/ports/user-repository.port.js';
import type { User } from '../../../domain/user.entity.js';

/**
 * Driven adapter: keeps users in memory for local development and tests.
 * Swap it for a database-backed adapter by rebinding `UserRepositoryPort`
 * in `UsersModule` — nothing else in the codebase has to change.
 */
@Injectable()
export class InMemoryUserRepository extends UserRepositoryPort {
  private readonly users = new Map<string, User>();

  async save(user: User): Promise<void> {
    this.users.set(user.id, user);
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }

    return null;
  }

  async findAll(): Promise<User[]> {
    return [...this.users.values()];
  }
}

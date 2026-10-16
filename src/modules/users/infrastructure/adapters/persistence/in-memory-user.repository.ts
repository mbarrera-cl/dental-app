import { Injectable } from '@nestjs/common';
import { UserRepositoryPort } from '../../../application/ports/user-repository.port.js';
import type { User } from '../../../domain/user.entity.js';
import { UserNotFoundError } from '../../../domain/user.errors.js';

/**
 * Driven adapter: keeps users in memory for local development and tests.
 * Swap it for a database-backed adapter by rebinding `UserRepositoryPort`
 * in `UsersModule` — nothing else in the codebase has to change.
 */
@Injectable()
export class InMemoryUserRepository extends UserRepositoryPort {
  private readonly users = new Map<string, User>();

  private readonly roleAssignments = new Map<string, Set<string>>();

  async save(user: User): Promise<void> {
    this.users.set(user.id, user);
  }

  async update(user: User): Promise<void> {
    if (!this.users.has(user.id)) {
      throw new UserNotFoundError(user.id);
    }

    this.users.set(user.id, user);
  }

  async delete(id: string): Promise<void> {
    if (!this.users.delete(id)) {
      throw new UserNotFoundError(id);
    }

    this.roleAssignments.delete(id);
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

  async existsActiveAdmin(): Promise<boolean> {
    // Dev double: any role counts as an administrative role (there is no
    // role catalog here); tests that care about the real semantics use the
    // SQLite adapter.
    for (const user of this.users.values()) {
      const roles = this.roleAssignments.get(user.id);

      if (user.status === 'active' && user.hasPassword && (roles?.size ?? 0) > 0) {
        return true;
      }
    }

    return false;
  }

  async listUserIdsWithoutRoles(): Promise<string[]> {
    return [...this.users.keys()].filter(
      (id) => (this.roleAssignments.get(id)?.size ?? 0) === 0,
    );
  }

  async assignRoleToUsers(roleId: string, userIds: readonly string[]): Promise<void> {
    for (const userId of userIds) {
      const roles = this.roleAssignments.get(userId) ?? new Set<string>();
      roles.add(roleId);
      this.roleAssignments.set(userId, roles);
    }
  }
}

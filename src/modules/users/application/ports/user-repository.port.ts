import type { User } from '../../domain/user.entity.js';

/**
 * Driven port (secondary port): the persistence contract the application
 * needs. Concrete adapters live in `infrastructure/adapters` and are bound
 * to this class in the feature module (composition root).
 *
 * It is declared as an abstract class so it can double as the NestJS
 * injection token — no string tokens or symbols required.
 */
export abstract class UserRepositoryPort {
  abstract save(user: User): Promise<void>;

  /** Updates an existing user; throws `UserNotFoundError` when it does not exist. */
  abstract update(user: User): Promise<void>;

  /** Deletes a user; throws `UserNotFoundError` when it does not exist. */
  abstract delete(id: string): Promise<void>;

  abstract findById(id: string): Promise<User | null>;

  /** Expects an already normalized email (as produced by the `Email` value object). */
  abstract findByEmail(email: string): Promise<User | null>;

  abstract findAll(): Promise<User[]>;

  /**
   * True when at least one active user with credentials holds the built-in
   * admin role. Drives the self-healing bootstrap and the "last admin"
   * protections.
   */
  abstract existsActiveAdmin(): Promise<boolean>;

  /** Ids of users without any role — used by the first-run role seed. */
  abstract listUserIdsWithoutRoles(): Promise<string[]>;

  /** Assigns a role to every given user (idempotent). */
  abstract assignRoleToUsers(roleId: string, userIds: readonly string[]): Promise<void>;
}

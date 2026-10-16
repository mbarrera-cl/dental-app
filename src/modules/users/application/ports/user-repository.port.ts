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

  abstract findById(id: string): Promise<User | null>;

  /** Expects an already normalized email (as produced by the `Email` value object). */
  abstract findByEmail(email: string): Promise<User | null>;

  abstract findAll(): Promise<User[]>;
}

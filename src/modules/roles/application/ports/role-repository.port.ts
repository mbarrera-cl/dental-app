import type { Role } from '../../domain/role.entity.js';

/** A role together with the number of users it is assigned to. */
export interface RoleWithUsage {
  readonly role: Role;
  readonly userCount: number;
}

/**
 * Driven port for role persistence. `user_roles` (the user ⇄ role join table)
 * is written by the users context; this port only reads it for usage counts
 * and the deletion guard.
 */
export abstract class RoleRepositoryPort {
  /** Inserts a new role; throws `RoleNameTakenError` when the name exists. */
  abstract save(role: Role): Promise<void>;

  /** Updates an existing role; throws `RoleNotFoundError` when it does not exist. */
  abstract update(role: Role): Promise<void>;

  /** Deletes a role; throws `RoleNotFoundError` when it does not exist. */
  abstract delete(id: string): Promise<void>;

  abstract findById(id: string): Promise<RoleWithUsage | null>;

  /** Case-insensitive lookup (the name column is COLLATE NOCASE). */
  abstract findByName(name: string): Promise<Role | null>;

  /** All roles ordered for display (built-in first, then by name). */
  abstract findAll(): Promise<RoleWithUsage[]>;

  abstract countAssignedUsers(roleId: string): Promise<number>;
}

import { Injectable } from '@nestjs/common';
import { RoleRepositoryPort, type RoleWithUsage } from '../../../application/ports/role-repository.port.js';
import { Role } from '../../../domain/role.entity.js';
import { RoleNameTakenError, RoleNotFoundError } from '../../../domain/role.errors.js';

/**
 * Driven adapter: keeps roles in memory for tests and local experiments.
 * Swap it for the SQLite adapter by rebinding `RoleRepositoryPort` in
 * `RolesModule`.
 */
@Injectable()
export class InMemoryRoleRepository extends RoleRepositoryPort {
  private readonly roles = new Map<string, Role>();

  private readonly userCounts = new Map<string, number>();

  /** Test helper: pretends that `count` users hold the role. */
  setUserCount(roleId: string, count: number): void {
    this.userCounts.set(roleId, count);
  }

  async save(role: Role): Promise<void> {
    this.assertNameAvailable(role);
    this.roles.set(role.id, role);
  }

  async update(role: Role): Promise<void> {
    if (!this.roles.has(role.id)) {
      throw new RoleNotFoundError(role.id);
    }

    this.assertNameAvailable(role);
    this.roles.set(role.id, role);
  }

  async delete(id: string): Promise<void> {
    if (!this.roles.delete(id)) {
      throw new RoleNotFoundError(id);
    }

    this.userCounts.delete(id);
  }

  async findById(id: string): Promise<RoleWithUsage | null> {
    const role = this.roles.get(id);

    return role === undefined ? null : { role, userCount: this.userCounts.get(id) ?? 0 };
  }

  async findByName(name: string): Promise<Role | null> {
    const normalized = name.trim().toLowerCase();

    for (const role of this.roles.values()) {
      if (role.name.toLowerCase() === normalized) {
        return role;
      }
    }

    return null;
  }

  async findAll(): Promise<RoleWithUsage[]> {
    return [...this.roles.values()]
      .sort((a, b) => Number(b.builtIn) - Number(a.builtIn) || a.name.localeCompare(b.name))
      .map((role) => ({ role, userCount: this.userCounts.get(role.id) ?? 0 }));
  }

  async countAssignedUsers(roleId: string): Promise<number> {
    return this.userCounts.get(roleId) ?? 0;
  }

  private assertNameAvailable(role: Role): void {
    for (const existing of this.roles.values()) {
      if (existing.id !== role.id && existing.name.toLowerCase() === role.name.toLowerCase()) {
        throw new RoleNameTakenError(role.name);
      }
    }
  }
}

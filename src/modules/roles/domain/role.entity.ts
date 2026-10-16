import { Entity } from '../../../shared/domain/entity.js';
import { PermissionUnknownError } from '../../../shared/security/permission.errors.js';
import { allPermissionKeys, isPermissionKey } from '../../../shared/security/permissions.js';
import { InvalidRoleDescriptionError, InvalidRoleNameError } from './role.errors.js';

/** Name of the built-in administrator role (cannot be renamed nor deleted). */
export const ADMIN_ROLE_NAME = 'admin';

/** Shared by the entity and the inbound DTO so HTTP and domain agree. */
export const ROLE_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u;

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 40;
const DESCRIPTION_MAX_LENGTH = 200;

export interface RoleProps {
  name: string;
  description: string;
  permissions: string[];
  builtIn: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRoleProps {
  name: string;
  description?: string;
  permissions: readonly string[];
  /** Only the bootstrapper creates built-in roles. */
  builtIn?: boolean;
}

/**
 * Role aggregate root. A role is pure data: its permissions are a subset of
 * the code-defined catalog, and administrators compose them freely from the
 * panel. `builtIn` marks the protected `admin` role.
 */
export class Role extends Entity<RoleProps> {
  private constructor(props: RoleProps, id?: string) {
    super(props, id);
  }

  static create({ name, description = '', permissions, builtIn = false }: CreateRoleProps): Role {
    const now = new Date();

    return new Role({
      name: Role.normalizeName(name),
      description: Role.normalizeDescription(description),
      permissions: Role.normalizePermissions(permissions),
      builtIn,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: RoleProps, id: string): Role {
    return new Role(props, id);
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string {
    return this.props.description;
  }

  get permissions(): readonly string[] {
    return this.props.permissions;
  }

  get builtIn(): boolean {
    return this.props.builtIn;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** Built-in roles cannot be renamed, deleted nor stripped of critical permissions. */
  get isProtected(): boolean {
    return this.props.builtIn;
  }

  hasPermission(key: string): boolean {
    return this.props.permissions.includes(key);
  }

  rename(name: string): void {
    this.props.name = Role.normalizeName(name);
    this.touch();
  }

  changeDescription(description: string): void {
    this.props.description = Role.normalizeDescription(description);
    this.touch();
  }

  changePermissions(permissions: readonly string[]): void {
    this.props.permissions = Role.normalizePermissions(permissions);
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  private static normalizeName(name: string): string {
    const normalized = name.trim();

    if (
      normalized.length < NAME_MIN_LENGTH ||
      normalized.length > NAME_MAX_LENGTH ||
      !ROLE_NAME_PATTERN.test(normalized)
    ) {
      throw new InvalidRoleNameError(name);
    }

    return normalized;
  }

  private static normalizeDescription(description: string): string {
    const normalized = description.trim();

    if (normalized.length > DESCRIPTION_MAX_LENGTH) {
      throw new InvalidRoleDescriptionError();
    }

    return normalized;
  }

  /**
   * Permissions must exist in the catalog; duplicates are dropped and the
   * result is kept in catalog order so stored roles diff cleanly and every
   * surface (API, panel, tokens) shows them consistently.
   */
  private static normalizePermissions(permissions: readonly string[]): string[] {
    const unique = [...new Set(permissions)];
    const unknown = unique.filter((key) => !isPermissionKey(key));

    if (unknown.length > 0) {
      throw new PermissionUnknownError(unknown);
    }

    const catalogOrder = new Map<string, number>(
      allPermissionKeys().map((key, index) => [key, index]),
    );

    return unique.sort((a, b) => catalogOrder.get(a)! - catalogOrder.get(b)!);
  }
}

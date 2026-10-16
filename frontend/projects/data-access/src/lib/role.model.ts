/**
 * Models for the roles API. They mirror `role-response.dto.ts`. Roles are
 * 100% data-driven: every role (except the protected `admin`) can be created,
 * renamed and re-scoped from the admin panel.
 */

/** Minimal role identity attached to users and sessions. */
export interface RoleRef {
  id: string;
  name: string;
}

export interface Role extends RoleRef {
  description: string;
  permissions: string[];
  /** Built-in roles are protected from rename/delete. */
  builtIn: boolean;
  /** Number of users the role is currently assigned to. */
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRolePayload {
  name: string;
  description?: string;
  permissions: string[];
}

/** Payload of `PATCH /roles/:id`; every field is optional. */
export interface UpdateRolePayload {
  name?: string;
  description?: string;
  permissions?: string[];
}

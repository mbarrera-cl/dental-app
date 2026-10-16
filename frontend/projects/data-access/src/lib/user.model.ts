import type { RoleRef } from './role.model';

/**
 * Domain model shared by the remotes. Mirrors the JSON returned by the
 * backend (`user-response.dto.ts`).
 */
export interface User {
  id: string;
  email: string;
  name: string;
  /** ISO-8601 timestamp. */
  createdAt: string;
  /**
   * Fields below belong to the extended user contract (roles, direct
   * permissions, account state). Optional so payloads from older backends
   * keep type-checking; the panel treats them as absent until they arrive.
   */
  roles?: RoleRef[];
  directPermissions?: string[];
  status?: 'active' | 'disabled';
  lastLoginAt?: string | null;
  mustChangePassword?: boolean;
}

/** Payload accepted by `POST /users` (mirrors the backend validation rules). */
export interface CreateUserPayload {
  name: string;
  email: string;
  /** Initial password; when omitted the account cannot sign in yet. */
  password?: string;
  roles?: string[];
  status?: 'active' | 'disabled';
}

/** Payload accepted by `PATCH /users/:id`: every field is optional. */
export interface UpdateUserPayload {
  name?: string;
  email?: string;
  roles?: string[];
  status?: 'active' | 'disabled';
}

/** Payload of `POST /users/:id/password`. */
export interface SetPasswordPayload {
  /** Typed password; ignored when `generate` is `true`. */
  password?: string;
  /** Ask the backend to generate one and return it in the response. */
  generate?: boolean;
}

export interface SetPasswordResult {
  /** Present only when the password was generated. */
  generatedPassword?: string;
}

/**
 * Models for the authentication API. They mirror the JSON produced by the
 * backend `auth` module (`auth-session.response.dto.ts`).
 */

/** Minimum user representation returned alongside a session. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  status: 'active' | 'disabled';
}

/** How each effective permission was granted (roles vs. direct grants). */
export interface PermissionBreakdown {
  fromRoles: string[];
  direct: string[];
  effective: string[];
}

/** The authenticated identity: user, roles and effective permissions. */
export interface AuthProfile {
  user: AuthUser;
  roles: Array<{ id: string; name: string }>;
  permissions: PermissionBreakdown;
}

/**
 * A sign-in response. `accessToken` must be kept in memory only — the refresh
 * token lives in an httpOnly cookie managed by the browser.
 */
export interface AuthSession extends AuthProfile {
  accessToken: string;
  /** Access token lifetime in seconds. */
  expiresIn: number;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

/** Used by the forced-change flow: the account is locked until it succeeds. */
export interface ChangeExpiredPasswordPayload {
  email: string;
  currentPassword: string;
  newPassword: string;
}

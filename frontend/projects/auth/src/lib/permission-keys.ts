/**
 * Typed permission keys used by the UI (navigation, action buttons, matrix).
 * They mirror the backend catalog (`src/shared/security/permissions.ts`).
 * A typo here only affects the UI — the server always enforces.
 */
export const PERMISSION_KEYS = {
  users: {
    read: 'users:read',
    create: 'users:create',
    update: 'users:update',
    delete: 'users:delete',
    resetPassword: 'users:reset-password',
    permissions: 'users:permissions',
  },
  roles: {
    read: 'roles:read',
    create: 'roles:create',
    update: 'roles:update',
    delete: 'roles:delete',
  },
  settings: {
    read: 'settings:read',
    update: 'settings:update',
  },
  clinical: {
    read: 'clinical:read',
    create: 'clinical:create',
    update: 'clinical:update',
  },
  apiKeys: {
    self: 'apikeys:self',
    read: 'apikeys:read',
    manage: 'apikeys:manage',
  },
  dashboard: {
    read: 'dashboard:read',
  },
} as const;

export type PermissionKeys = typeof PERMISSION_KEYS;

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
  agenda: {
    read: 'agenda:read',
    create: 'agenda:create',
    update: 'agenda:update',
    cancel: 'agenda:cancel',
    professional: 'agenda:professional',
  },
  caroIa: {
    use: 'caroIa:use',
  },
  activity: {
    read: 'activity:read',
    readAll: 'activity:read-all',
    purge: 'activity:purge',
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
  quotes: {
    read: 'quotes:read',
    create: 'quotes:create',
    update: 'quotes:update',
    delete: 'quotes:delete',
    send: 'quotes:send',
    approve: 'quotes:approve',
  },
  uco: {
    read: 'uco:read',
    manage: 'uco:manage',
  },
  dashboard: {
    read: 'dashboard:read',
  },
} as const;

export type PermissionKeys = typeof PERMISSION_KEYS;

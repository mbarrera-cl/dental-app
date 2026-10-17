/**
 * Settings keys owned by the activity module. They live in the shared
 * registry (`settings/domain/settings-registry.ts`) so the admin panel renders
 * and audits them like any other configuration — the module only declares how
 * to read them.
 */
export const ACTIVITY_SETTINGS = {
  enabled: 'activity.enabled',
  captureMutations: 'activity.captureMutations',
  captureClinicalReads: 'activity.captureClinicalReads',
  captureFailures: 'activity.captureFailures',
  captureAuth: 'activity.captureAuth',
  capturePatients: 'activity.capturePatients',
  captureClinical: 'activity.captureClinical',
  captureUsers: 'activity.captureUsers',
  captureRoles: 'activity.captureRoles',
  captureSettings: 'activity.captureSettings',
  captureNavigation: 'activity.captureNavigation',
  captureClinic: 'activity.captureClinic',
  captureApiKeys: 'activity.captureApiKeys',
  captureMcp: 'activity.captureMcp',
  privacyIp: 'activity.privacyIp',
  privacyUserAgent: 'activity.privacyUserAgent',
  privacySubjectLabel: 'activity.privacySubjectLabel',
  privacyMetadata: 'activity.privacyMetadata',
  retentionDays: 'activity.retentionDays',
  panelLimit: 'activity.panelLimit',
  panelRefreshSeconds: 'activity.panelRefreshSeconds',
  panelBadge: 'activity.panelBadge',
} as const;

/**
 * Module → capture toggle. `auth` is handled separately (its events are
 * written explicitly by the auth controller and gated by `captureAuth`).
 */
export const ACTIVITY_MODULE_SETTINGS: Readonly<Record<string, string>> = {
  patients: ACTIVITY_SETTINGS.capturePatients,
  clinical: ACTIVITY_SETTINGS.captureClinical,
  users: ACTIVITY_SETTINGS.captureUsers,
  roles: ACTIVITY_SETTINGS.captureRoles,
  settings: ACTIVITY_SETTINGS.captureSettings,
  navigation: ACTIVITY_SETTINGS.captureNavigation,
  clinic: ACTIVITY_SETTINGS.captureClinic,
  apikeys: ACTIVITY_SETTINGS.captureApiKeys,
};

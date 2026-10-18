import type { SettingDefinition, SettingGroup } from '../../settings/domain/setting-definition.js';

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

/** Registry definitions owned by the activity context (consumed by the settings engine). */
export const ACTIVITY_SETTING_GROUPS: readonly SettingGroup[] = [
  { id: 'activity', description: 'Activity trail: capture, privacy, retention and panel' },
];

export const ACTIVITY_SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  {
    key: 'activity.enabled',
    group: 'activity',
    type: 'boolean',
    default: true,
    description: 'Record the platform activity trail (master switch)',
  },
  {
    key: 'activity.captureMutations',
    group: 'activity',
    type: 'boolean',
    default: true,
    description: 'Record create, update and delete operations',
  },
  {
    key: 'activity.captureClinicalReads',
    group: 'activity',
    type: 'boolean',
    default: true,
    description: 'Record who opens a clinical record (sensitive access)',
  },
  {
    key: 'activity.captureFailures',
    group: 'activity',
    type: 'boolean',
    default: true,
    description: 'Record rejected attempts (403, 409, 500) next to successful ones',
  },
  {
    key: 'activity.captureAuth',
    group: 'activity',
    type: 'boolean',
    default: true,
    description: 'Record sign-in, sign-out and password events',
  },
  {
    key: 'activity.captureMcp',
    group: 'activity',
    type: 'boolean',
    default: true,
    description: 'Record MCP tool and resource calls',
  },
  {
    key: 'activity.capturePatients',
    group: 'activity',
    type: 'boolean',
    default: true,
    description: 'Record actions on patients',
  },
  {
    key: 'activity.captureClinical',
    group: 'activity',
    type: 'boolean',
    default: true,
    description: 'Record actions on clinical records and the odontogram',
  },
  {
    key: 'activity.captureUsers',
    group: 'activity',
    type: 'boolean',
    default: true,
    description: 'Record actions on users',
  },
  {
    key: 'activity.captureRoles',
    group: 'activity',
    type: 'boolean',
    default: true,
    description: 'Record actions on roles and permissions',
  },
  {
    key: 'activity.captureSettings',
    group: 'activity',
    type: 'boolean',
    default: true,
    description: 'Record configuration changes',
  },
  {
    key: 'activity.captureNavigation',
    group: 'activity',
    type: 'boolean',
    default: true,
    description: 'Record changes to the side menu',
  },
  {
    key: 'activity.captureClinic',
    group: 'activity',
    type: 'boolean',
    default: true,
    description: 'Record branding and logo changes',
  },
  {
    key: 'activity.captureApiKeys',
    group: 'activity',
    type: 'boolean',
    default: true,
    description: 'Record API key creation, rotation and revocation',
  },
  {
    key: 'activity.privacyIp',
    group: 'activity',
    type: 'boolean',
    default: true,
    description: 'Store the client IP address of each entry',
  },
  {
    key: 'activity.privacyUserAgent',
    group: 'activity',
    type: 'boolean',
    default: true,
    description: 'Store the browser user agent of each entry',
  },
  {
    key: 'activity.privacySubjectLabel',
    group: 'activity',
    type: 'boolean',
    default: true,
    description: 'Store a short label of the affected record (e.g. patient name)',
  },
  {
    key: 'activity.privacyMetadata',
    group: 'activity',
    type: 'boolean',
    default: false,
    description: 'Store small structured details (ids, counts); never clinical values',
  },
  {
    key: 'activity.retentionDays',
    group: 'activity',
    type: 'number',
    default: 180,
    min: 0,
    max: 3650,
    description: 'Days an entry is kept before the automatic cleanup (0 = forever)',
  },
  {
    key: 'activity.panelLimit',
    group: 'activity',
    type: 'number',
    default: 20,
    min: 5,
    max: 100,
    description: 'Entries shown in the header activity panel',
  },
  {
    key: 'activity.panelRefreshSeconds',
    group: 'activity',
    type: 'number',
    default: 60,
    min: 0,
    max: 600,
    description: 'Panel refresh interval while open (0 = only on open)',
  },
  {
    key: 'activity.panelBadge',
    group: 'activity',
    type: 'boolean',
    default: true,
    description: 'Show the new-activity indicator on the header icon',
  },
];

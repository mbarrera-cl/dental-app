import type { SettingDefinition, SettingGroup } from './setting-definition.js';

/**
 * Platform/UI settings owned by the settings context (not by a business
 * module): they tune how the shell renders, not what the clinic does.
 */
export const UI_SETTING_GROUPS: readonly SettingGroup[] = [
  { id: 'ui', description: 'Interface defaults shared by every list and panel' },
];

export const UI_SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  {
    key: 'ui.defaultPageSize',
    group: 'ui',
    type: 'number',
    default: 10,
    min: 5,
    max: 100,
    description: 'Rows per page shown by every paginated list (5–100)',
  },
];

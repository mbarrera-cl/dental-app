import type { SettingDefinition, SettingGroup } from '../../settings/domain/setting-definition.js';

/** Settings owned by the quotes context (Arancel UCO behaviour). */
export const QUOTES_SETTING_GROUPS: readonly SettingGroup[] = [
  { id: 'quotes', description: 'Quotations (Arancel UCO) behaviour' },
];

export const QUOTES_SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  {
    key: 'quotes.ucoRate',
    group: 'quotes',
    type: 'number',
    default: 3000,
    min: 1,
    max: 10_000_000,
    description: 'CLP value of a single UCO unit (used to propose line prices)',
  },
  {
    key: 'quotes.folioPrefix',
    group: 'quotes',
    type: 'string',
    default: 'COT',
    maxLength: 8,
    description: 'Prefix of the quote folio (e.g. `COT`)',
  },
  {
    key: 'quotes.defaultValidityDays',
    group: 'quotes',
    type: 'number',
    default: 30,
    min: 1,
    max: 3650,
    description: 'Default validity of a quote, in days',
  },
];

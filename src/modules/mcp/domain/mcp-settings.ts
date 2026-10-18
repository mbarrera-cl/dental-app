import type { SettingDefinition, SettingGroup } from '../../settings/domain/setting-definition.js';

/**
 * Settings owned by the MCP context. The write gate, PII redaction and the
 * confirmation requirement are `security`-sensitive; search/rate limits are
 * regular operational tuning.
 */
export const MCP_SETTING_GROUPS: readonly SettingGroup[] = [
  { id: 'mcp', description: 'Model Context Protocol server (tools and safety limits)' },
];

export const MCP_SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  {
    key: 'mcp.allowWrites',
    group: 'mcp',
    type: 'boolean',
    default: false,
    sensitivity: 'security',
    description: 'Allow MCP tools to create or modify data (scopes are still enforced)',
  },
  {
    key: 'mcp.maxResults',
    group: 'mcp',
    type: 'number',
    default: 20,
    min: 1,
    max: 100,
    description: 'Maximum rows returned by an MCP search or list tool',
  },
  {
    key: 'mcp.writeRateLimitPerMinute',
    group: 'mcp',
    type: 'number',
    default: 20,
    min: 1,
    max: 120,
    description: 'Maximum write tool calls per API key per minute',
  },
  {
    key: 'mcp.redactPii',
    group: 'mcp',
    type: 'boolean',
    default: false,
    sensitivity: 'security',
    description: 'Mask RUT, email and phone numbers in MCP tool output',
  },
  {
    key: 'mcp.requireConfirmation',
    group: 'mcp',
    type: 'boolean',
    default: true,
    sensitivity: 'security',
    description: 'Require confirm: true for approve, reject, delete and restore tools',
  },
];

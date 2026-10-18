import type { SettingDefinition, SettingGroup } from '../../settings/domain/setting-definition.js';

/**
 * Settings owned by the CaroIA context. The write-approval gate is
 * `security`-sensitive; retention and limits are operational tuning.
 */
export const CARO_IA_SETTING_GROUPS: readonly SettingGroup[] = [
  { id: 'caroIa', description: 'CaroIA assistant (chat, audio and write approvals)' },
];

export const CARO_IA_SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  {
    key: 'caroIa.allowWrites',
    group: 'caroIa',
    type: 'boolean',
    default: false,
    sensitivity: 'security',
    description: 'Allow CaroIA to propose write actions that require human approval',
  },
  {
    key: 'caroIa.retentionDays',
    group: 'caroIa',
    type: 'number',
    default: 0,
    min: 0,
    max: 3650,
    description: 'Delete conversations older than this many days (0 = keep forever)',
  },
  {
    key: 'caroIa.maxMessageLength',
    group: 'caroIa',
    type: 'number',
    default: 4000,
    min: 100,
    max: 20_000,
    description: 'Maximum characters in one typed or transcribed message',
  },
  {
    key: 'caroIa.messageRateLimitPerMinute',
    group: 'caroIa',
    type: 'number',
    default: 20,
    min: 1,
    max: 120,
    description: 'Maximum CaroIA messages per user per minute',
  },
  {
    key: 'caroIa.maxAudioSeconds',
    group: 'caroIa',
    type: 'number',
    default: 120,
    min: 10,
    max: 600,
    description: 'Maximum audio duration accepted for transcription',
  },
  {
    key: 'caroIa.maxAudioBytes',
    group: 'caroIa',
    type: 'number',
    default: 10_485_760,
    min: 1_048_576,
    max: 26_214_400,
    description: 'Maximum audio file size accepted for transcription (bytes)',
  },
];

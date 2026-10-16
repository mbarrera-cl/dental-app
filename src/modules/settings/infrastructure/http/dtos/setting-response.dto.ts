import { ApiProperty } from '@nestjs/swagger';
import type { SettingOverview, SettingType, SettingValue } from '../../../domain/setting-definition.js';

/**
 * Outbound DTO: a setting definition merged with its effective value. The
 * admin panel renders its dynamic form from this shape alone.
 */
export class SettingResponseDto {
  @ApiProperty({ example: 'passwordPolicy.minLength' })
  key: string;

  @ApiProperty({ example: 'passwordPolicy' })
  group: string;

  @ApiProperty({ enum: ['number', 'boolean', 'string'], example: 'number' })
  type: SettingType;

  @ApiProperty({ oneOf: [{ type: 'number' }, { type: 'boolean' }, { type: 'string' }], example: 8 })
  value: SettingValue;

  @ApiProperty({ oneOf: [{ type: 'number' }, { type: 'boolean' }, { type: 'string' }], example: 8 })
  default: SettingValue;

  @ApiProperty({ example: 6, required: false })
  min?: number;

  @ApiProperty({ example: 64, required: false })
  max?: number;

  @ApiProperty({ example: 'Minimum password length' })
  description: string;

  static fromOverview(overview: SettingOverview): SettingResponseDto {
    const dto = new SettingResponseDto();
    dto.key = overview.key;
    dto.group = overview.group;
    dto.type = overview.type;
    dto.value = overview.value;
    dto.default = overview.default;
    dto.min = overview.min;
    dto.max = overview.max;
    dto.description = overview.description;
    return dto;
  }
}

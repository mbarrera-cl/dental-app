import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

/**
 * Inbound DTO of `PATCH /settings`. Keys are validated against the settings
 * registry in the domain layer (unknown keys and wrong value types are
 * rejected with a detailed error), so here it is enough to require an object.
 */
export class UpdateSettingsRequestDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {
      'passwordPolicy.minLength': 10,
      'login.maxFailedAttempts': 3,
    },
  })
  @IsObject()
  values: Record<string, unknown>;
}

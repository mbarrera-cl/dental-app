import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

/**
 * Admin password reset. Provide a typed `password` or `generate: true` (the
 * server returns a random one that satisfies the policy). Providing neither
 * fails the use case with `EmptyPasswordResetError`.
 */
export class SetUserPasswordRequestDto {
  @ApiPropertyOptional({
    example: 'Nueva-Str0ng-Passw0rd!',
    description: 'New password typed by the administrator.',
  })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Generate a random password that satisfies the policy; it is returned once.',
  })
  @IsOptional()
  @IsBoolean()
  generate?: boolean;
}

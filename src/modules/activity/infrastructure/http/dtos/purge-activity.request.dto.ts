import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsISO8601, IsOptional } from 'class-validator';

/**
 * Destructive cleanup scope. `all: true` deletes every entry; otherwise
 * `before` deletes entries strictly older than the given instant.
 */
export class PurgeActivityRequestDto {
  @ApiPropertyOptional({ example: false, description: 'Delete every entry' })
  @IsOptional()
  @IsBoolean()
  all?: boolean;

  @ApiPropertyOptional({
    example: '2026-01-01T00:00:00.000Z',
    description: 'Delete entries older than this ISO-8601 instant',
  })
  @IsOptional()
  @IsISO8601()
  before?: string;
}

export class PurgePreviewResponseDto {
  count: number;
}

export class PurgeResultResponseDto {
  deleted: number;
  at: string;
}

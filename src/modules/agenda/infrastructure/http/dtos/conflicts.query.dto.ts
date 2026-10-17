import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsUUID } from 'class-validator';

export class ConflictsQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  professionalId!: string;

  @ApiProperty({ example: '2026-10-20T14:00:00.000Z' })
  @IsISO8601()
  startsAt!: string;

  @ApiProperty({ example: '2026-10-20T14:30:00.000Z' })
  @IsISO8601()
  endsAt!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  excludeId?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsUUID } from 'class-validator';

export class ListAppointmentsQueryDto {
  @ApiProperty({ example: '2026-10-18T00:00:00.000Z' })
  @IsISO8601()
  from!: string;

  @ApiProperty({ example: '2026-10-25T00:00:00.000Z' })
  @IsISO8601()
  to!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  professionalId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  patientId?: string;
}

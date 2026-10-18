import { ApiProperty } from '@nestjs/swagger';
import type { AgendaReason } from '../../../domain/agenda-reason.entity.js';

export class AgendaReasonResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  static fromDomain(reason: AgendaReason): AgendaReasonResponseDto {
    return {
      id: reason.id,
      name: reason.name,
      createdAt: reason.createdAt.toISOString(),
      updatedAt: reason.updatedAt.toISOString(),
    };
  }
}

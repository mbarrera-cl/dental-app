import { ApiProperty } from '@nestjs/swagger';
import { UcoProcedure } from '../../../domain/uco-procedure.entity.js';

/** Outbound DTO of a UCO fee catalog entry. */
export class UcoProcedureResponseDto {
  @ApiProperty({ example: '01HG…' })
  id: string;

  @ApiProperty({ example: '010001' })
  code: string;

  @ApiProperty({ example: '1' })
  chapter: string;

  @ApiProperty({ example: 'Consulta dental de urgencia' })
  name: string;

  @ApiProperty({ example: 1.5 })
  units: number;

  @ApiProperty({ enum: ['active', 'inactive'], example: 'active' })
  status: 'active' | 'inactive';

  @ApiProperty({ example: '2026-10-17T00:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-10-17T00:00:00.000Z' })
  updatedAt: string;

  static fromDomain(procedure: UcoProcedure): UcoProcedureResponseDto {
    const dto = new UcoProcedureResponseDto();
    dto.id = procedure.id;
    dto.code = procedure.code;
    dto.chapter = procedure.chapter;
    dto.name = procedure.name;
    dto.units = procedure.units;
    dto.status = procedure.status;
    dto.createdAt = procedure.createdAt.toISOString();
    dto.updatedAt = procedure.updatedAt.toISOString();
    return dto;
  }
}

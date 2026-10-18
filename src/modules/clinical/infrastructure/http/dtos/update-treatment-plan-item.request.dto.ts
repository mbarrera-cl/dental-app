import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TREATMENT_PLAN_ITEM_STATUSES } from '../../../domain/treatment-plan.entity.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateTreatmentPlanItemRequestDto {
  @ApiPropertyOptional({
    enum: TREATMENT_PLAN_ITEM_STATUSES,
    example: 'realizado',
  })
  @IsOptional()
  @IsIn(TREATMENT_PLAN_ITEM_STATUSES)
  status?: string;

  @ApiPropertyOptional({
    nullable: true,
    example: 36,
    minimum: 11,
    maximum: 85,
  })
  @IsOptional()
  @IsInt()
  @Min(11)
  @Max(85)
  tooth?: number | null;

  @ApiPropertyOptional({ example: 'Endodoncia pieza 36' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  procedure?: string;

  @ApiPropertyOptional({ nullable: true, example: 'ENDO-MOLAR' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  ucoCode?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 500 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

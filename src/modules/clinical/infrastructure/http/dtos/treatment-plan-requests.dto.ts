import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateTreatmentPlanNotesRequestDto {
  @ApiPropertyOptional({
    nullable: true,
    description: 'Rich-text (sanitized) note; omitted or empty clears it.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  notes?: string | null;
}

export class DeleteTreatmentPlanItemRequestDto {
  @ApiProperty({ example: 'Procedimiento duplicado del presupuesto anterior.' })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  reason: string;
}

export class ImportQuoteRequestDto {
  @ApiProperty()
  @IsString()
  quoteId: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Quote line ids to import (the operator choices from the preview). Omit to import only the unambiguous new lines.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  itemIds?: string[];
}

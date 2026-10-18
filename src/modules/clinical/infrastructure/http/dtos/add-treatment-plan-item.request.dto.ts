import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class AddTreatmentPlanItemRequestDto {
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

  @ApiProperty({ example: 'Endodoncia pieza 36' })
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  procedure: string;

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

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { FINDING_SYMBOLS, SURFACES } from '../../../domain/finding.entity.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const GRADES = [1, 2, 3];

/**
 * One odontogram action. Colors are derived server-side from the symbol
 * (current problems vs performed treatments), never sent by the client.
 */
export class AddClinicalFindingRequestDto {
  @ApiProperty({ example: 16, minimum: 11, maximum: 85 })
  @IsInt()
  @Min(11)
  @Max(85)
  tooth: number;

  @ApiPropertyOptional({
    enum: SURFACES,
    isArray: true,
    example: ['O'],
    description: 'Empty/omitted means "the whole tooth".',
  })
  @IsOptional()
  @IsArray()
  @IsIn(SURFACES, { each: true })
  surfaces?: string[];

  @ApiProperty({ enum: FINDING_SYMBOLS, example: 'caries' })
  @IsIn(FINDING_SYMBOLS)
  symbol: string;

  @ApiPropertyOptional({ enum: GRADES, nullable: true, example: 2 })
  @IsOptional()
  @IsInt()
  @IsIn(GRADES)
  recesion?: number | null;

  @ApiPropertyOptional({ enum: GRADES, nullable: true, example: 1 })
  @IsOptional()
  @IsInt()
  @IsIn(GRADES)
  movilidad?: number | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 500 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

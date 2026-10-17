import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** One line of the quote payloads. */
export class QuoteItemRequestDto {
  /** Existing line id; omit to create a new line. */
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  ucoCode?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  piezaDental?: string | null;

  @IsInt()
  @Min(1)
  @Max(10000)
  quantity: number;

  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  unitPrice: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  discountPercent?: number;
}

export class CreateQuoteRequestDto {
  @IsString()
  @IsNotEmpty()
  patientId: string;

  @IsOptional()
  @IsString()
  validUntil?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuoteItemRequestDto)
  items: QuoteItemRequestDto[];
}

export class UpdateQuoteRequestDto {
  @IsOptional()
  @IsString()
  validUntil?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuoteItemRequestDto)
  items: QuoteItemRequestDto[];
}

export class DecideQuoteItemRequestDto {
  @IsIn(['generado', 'aprobado', 'rechazado'])
  status: 'generado' | 'aprobado' | 'rechazado';
}

export class ChangeQuoteStatusRequestDto {
  @IsIn(['borrador', 'sin_respuesta', 'aprobada', 'rechazada'])
  status: 'borrador' | 'sin_respuesta' | 'aprobada' | 'rechazada';
}

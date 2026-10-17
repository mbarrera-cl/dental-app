import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Payload accepted by `POST /uco` (create). */
export class CreateUcoProcedureRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  chapter: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @Type(() => Number)
  @IsNotEmpty()
  units: number;
}

/** Payload accepted by `PATCH /uco/:id` (partial update, including the soft-delete toggle). */
export class UpdateUcoProcedureRequestDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  code?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  chapter?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  units?: number;

  @IsOptional()
  active?: boolean;
}

import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** One prescribed medication of the request payload. */
export class PrescriptionItemRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  medicamento: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  dosis: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  frecuencia: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  duracion: string;
}

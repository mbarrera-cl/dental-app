import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PrescriptionItemRequestDto } from './prescription-item.request.dto.js';

/** Inbound payload of `POST /patients/:patientId/prescriptions`. */
export class CreatePrescriptionRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemRequestDto)
  items: PrescriptionItemRequestDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  indicaciones?: string | null;
}

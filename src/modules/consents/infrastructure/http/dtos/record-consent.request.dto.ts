import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Inbound payload of `POST /patients/:patientId/consents`. */
export class RecordConsentRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  templateKey: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  procedure?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  acceptorName: string;
}

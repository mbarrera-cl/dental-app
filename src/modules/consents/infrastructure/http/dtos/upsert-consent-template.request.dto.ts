import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Inbound payload of `PUT /consents/templates` (create or edit by key). */
export class UpsertConsentTemplateRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  key: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20_000)
  body: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

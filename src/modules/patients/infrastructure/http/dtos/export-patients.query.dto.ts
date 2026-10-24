import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Query parameters of the patients Excel export. */
export class ExportPatientsQueryDto {
  @ApiPropertyOptional({
    description: 'Search by name, email or RUT; mirrors the list page filter.',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

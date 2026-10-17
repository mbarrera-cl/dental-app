import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SearchPatientsQueryDto {
  @ApiPropertyOptional({ description: 'Name, RUT or partial match', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string;
}

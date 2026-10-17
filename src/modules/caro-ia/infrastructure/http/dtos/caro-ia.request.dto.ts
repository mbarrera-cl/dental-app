import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCaroConversationRequestDto {
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;
}

export class RenameCaroConversationRequestDto {
  @ApiProperty({ minLength: 1, maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  title!: string;
}

export class SendCaroMessageRequestDto {
  @ApiProperty({ minLength: 1, maxLength: 20_000 })
  @IsString()
  @MinLength(1)
  @MaxLength(20_000)
  content!: string;

  /** Reserved for the attachments phase; must be empty in this version. */
  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentIds?: string[];
}

export class DecideCaroApprovalRequestDto {
  @ApiProperty({ enum: ['approve', 'reject'] })
  @IsIn(['approve', 'reject'])
  decision!: 'approve' | 'reject';
}

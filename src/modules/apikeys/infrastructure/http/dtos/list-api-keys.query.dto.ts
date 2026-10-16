import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

/**
 * Query of `GET /apikeys`. Without parameters it lists the caller's own
 * keys; `userId` targets another user and `all=true` lists every key. Both
 * cross-user modes need `apikeys:read` (enforced by the controller).
 */
export class ListApiKeysQueryDto {
  @ApiPropertyOptional({ description: 'List the keys of this user.' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ enum: ['true'], description: 'List the keys of every user.' })
  @IsOptional()
  @IsIn(['true'])
  all?: string;
}

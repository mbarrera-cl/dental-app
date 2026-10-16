import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Outbound DTO of the admin password reset. The plain password is present
 * **only** when the server generated it, and it is the only time it can be
 * read: only hashes are persisted.
 */
export class SetUserPasswordResponseDto {
  @ApiPropertyOptional({ description: 'Generated password (shown exactly once).' })
  password?: string;
}

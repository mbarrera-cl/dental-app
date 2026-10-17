import { ApiProperty } from '@nestjs/swagger';

/** Answer of `DELETE /clinic/logo`: the version left active (`0` = no logo). */
export class LogoVersionResponseDto {
  @ApiProperty({ example: 2, description: '0 means the clinic has no logo' })
  version: number;

  static fromVersion(version: number): LogoVersionResponseDto {
    const dto = new LogoVersionResponseDto();
    dto.version = version;
    return dto;
  }
}

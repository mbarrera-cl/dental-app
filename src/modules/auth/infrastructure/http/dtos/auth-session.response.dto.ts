import { ApiProperty } from '@nestjs/swagger';
import type { AuthProfile, AuthSessionResult } from '../../../application/session.service.js';

export class AuthUserResponseDto {
  @ApiProperty() id!: string;

  @ApiProperty() email!: string;

  @ApiProperty() name!: string;

  @ApiProperty({ enum: ['active', 'disabled'] }) status!: 'active' | 'disabled';
}

export class RoleRefResponseDto {
  @ApiProperty() id!: string;

  @ApiProperty() name!: string;
}

export class PermissionsResponseDto {
  @ApiProperty({ type: [String] }) fromRoles!: string[];

  @ApiProperty({ type: [String] }) direct!: string[];

  @ApiProperty({ type: [String] }) effective!: string[];
}

export class AuthProfileResponseDto {
  @ApiProperty({ type: AuthUserResponseDto }) user!: AuthUserResponseDto;

  @ApiProperty({ type: [RoleRefResponseDto] }) roles!: RoleRefResponseDto[];

  @ApiProperty({ type: PermissionsResponseDto }) permissions!: PermissionsResponseDto;

  static fromProfile(profile: AuthProfile): AuthProfileResponseDto {
    const dto = new AuthProfileResponseDto();

    dto.user = { ...profile.user };
    dto.roles = profile.roles.map((role) => ({ ...role }));
    dto.permissions = {
      fromRoles: [...profile.permissions.fromRoles],
      direct: [...profile.permissions.direct],
      effective: [...profile.permissions.effective],
    };

    return dto;
  }
}

export class AuthSessionResponseDto extends AuthProfileResponseDto {
  @ApiProperty({ description: 'JWT access token (keep it in memory only)' })
  accessToken!: string;

  @ApiProperty({ description: 'Access token lifetime in seconds' })
  expiresIn!: number;

  static fromResult(result: AuthSessionResult): AuthSessionResponseDto {
    const dto = Object.assign(
      new AuthSessionResponseDto(),
      AuthProfileResponseDto.fromProfile(result.profile),
    );

    dto.accessToken = result.session.accessToken;
    dto.expiresIn = result.session.expiresInSeconds;

    return dto;
  }
}

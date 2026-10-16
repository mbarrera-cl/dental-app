import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentPrincipal } from '../../../../shared/security/current-principal.decorator.js';
import type { Principal } from '../../../../shared/security/principal.js';
import { Public } from '../../../../shared/security/public.decorator.js';
import { ChangeExpiredPasswordUseCase } from '../../application/use-cases/change-expired-password.use-case.js';
import { ChangePasswordUseCase } from '../../application/use-cases/change-password.use-case.js';
import { GetProfileUseCase } from '../../application/use-cases/get-profile.use-case.js';
import { LoginUseCase } from '../../application/use-cases/login.use-case.js';
import { LogoutUseCase } from '../../application/use-cases/logout.use-case.js';
import { RefreshUseCase } from '../../application/use-cases/refresh.use-case.js';
import { ChangeExpiredPasswordRequestDto } from './dtos/change-expired-password.request.dto.js';
import { ChangePasswordRequestDto } from './dtos/change-password.request.dto.js';
import { LoginRequestDto } from './dtos/login.request.dto.js';
import { AuthProfileResponseDto, AuthSessionResponseDto } from './dtos/auth-session.response.dto.js';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from './refresh-cookie.js';

/**
 * Driving adapter for authentication. Access tokens travel in the response
 * body (memory-only on the client); the refresh token travels exclusively
 * in the httpOnly `hexa_refresh` cookie, scoped to `/auth`.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshUseCase: RefreshUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
    private readonly changeExpiredPasswordUseCase: ChangeExpiredPasswordUseCase,
    private readonly getProfileUseCase: GetProfileUseCase,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials.' })
  async login(
    @Body() body: LoginRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponseDto> {
    const result = await this.loginUseCase.execute(body);

    setRefreshCookie(response, result.session.refreshToken, result.session.refreshExpiresAt);

    return AuthSessionResponseDto.fromResult(result);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the refresh token and get a new access token' })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, expired or replayed refresh token.' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponseDto> {
    const result = await this.refreshUseCase.execute({
      refreshToken: readRefreshCookie(request),
    });

    setRefreshCookie(response, result.session.refreshToken, result.session.refreshExpiresAt);

    return AuthSessionResponseDto.fromResult(result);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Sign out (revokes the refresh token and clears the cookie)' })
  @ApiNoContentResponse({ description: 'The session was ended.' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.logoutUseCase.execute({ refreshToken: readRefreshCookie(request) });

    clearRefreshCookie(response);
  }

  @Public()
  @Post('change-expired-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change an expired or admin-reset password and sign in' })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials.' })
  async changeExpiredPassword(
    @Body() body: ChangeExpiredPasswordRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponseDto> {
    const result = await this.changeExpiredPasswordUseCase.execute(body);

    setRefreshCookie(response, result.session.refreshToken, result.session.refreshExpiresAt);

    return AuthSessionResponseDto.fromResult(result);
  }

  @Get('me')
  @ApiOperation({ summary: 'Profile of the authenticated principal' })
  @ApiOkResponse({ type: AuthProfileResponseDto })
  @ApiUnauthorizedResponse({ description: 'Not authenticated.' })
  async me(@CurrentPrincipal() principal: Principal): Promise<AuthProfileResponseDto> {
    return AuthProfileResponseDto.fromProfile(await this.getProfileUseCase.execute(principal));
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change the password of the authenticated user' })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  @ApiUnauthorizedResponse({ description: 'Current password is wrong.' })
  async changePassword(
    @CurrentPrincipal() principal: Principal,
    @Body() body: ChangePasswordRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponseDto> {
    const result = await this.changePasswordUseCase.execute({
      userId: principal.userId,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });

    setRefreshCookie(response, result.session.refreshToken, result.session.refreshExpiresAt);

    return AuthSessionResponseDto.fromResult(result);
  }
}

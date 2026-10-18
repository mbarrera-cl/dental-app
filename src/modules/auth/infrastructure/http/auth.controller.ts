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
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentPrincipal } from '../../../../shared/security/current-principal.decorator.js';
import type { Principal } from '../../../../shared/security/principal.js';
import { Public } from '../../../../shared/security/public.decorator.js';
import { ActivityRecorder } from '../../../activity/application/record-activity.service.js';
import { ActivitySkip } from '../../../activity/infrastructure/http/activity-action.decorator.js';
import { activityStatusOf } from '../../../activity/infrastructure/http/activity-status.js';
import type { ActivityActorRef, ActivityOutcome } from '../../../activity/domain/activity-entry.js';
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
 *
 * Auth events are audited explicitly (instead of through the generic
 * interceptor): failures carry the attempted email and the event is useful
 * even when the caller has no principal yet.
 */
@ApiTags('auth')
@Controller('auth')
@ActivitySkip()
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshUseCase: RefreshUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
    private readonly changeExpiredPasswordUseCase: ChangeExpiredPasswordUseCase,
    private readonly getProfileUseCase: GetProfileUseCase,
    private readonly activity: ActivityRecorder,
  ) {}

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials.' })
  async login(
    @Body() body: LoginRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponseDto> {
    try {
      const result = await this.loginUseCase.execute(body);

      setRefreshCookie(response, result.session.refreshToken, result.session.refreshExpiresAt);
      await this.audit(request, {
        actor: { id: result.profile.user.id, type: 'user' },
        action: 'auth.login',
        outcome: 'success',
        statusCode: 200,
      });

      return AuthSessionResponseDto.fromResult(result);
    } catch (error) {
      await this.audit(request, {
        actor: { id: null, type: 'anonymous', label: body.email },
        action: 'auth.login',
        outcome: 'failure',
        statusCode: activityStatusOf(error),
      });

      throw error;
    }
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
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
    const userId = await this.logoutUseCase.execute({ refreshToken: readRefreshCookie(request) });

    clearRefreshCookie(response);

    if (userId !== null) {
      await this.audit(request, {
        actor: { id: userId, type: 'user' },
        action: 'auth.logout',
        outcome: 'success',
        statusCode: 204,
      });
    }
  }

  @Public()
  @Post('change-expired-password')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change an expired or admin-reset password and sign in' })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials.' })
  async changeExpiredPassword(
    @Body() body: ChangeExpiredPasswordRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponseDto> {
    try {
      const result = await this.changeExpiredPasswordUseCase.execute(body);

      setRefreshCookie(response, result.session.refreshToken, result.session.refreshExpiresAt);
      await this.audit(request, {
        actor: { id: result.profile.user.id, type: 'user' },
        action: 'auth.change-expired-password',
        outcome: 'success',
        statusCode: 200,
      });

      return AuthSessionResponseDto.fromResult(result);
    } catch (error) {
      await this.audit(request, {
        actor: { id: null, type: 'anonymous', label: body.email },
        action: 'auth.change-expired-password',
        outcome: 'failure',
        statusCode: activityStatusOf(error),
      });

      throw error;
    }
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
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponseDto> {
    try {
      const result = await this.changePasswordUseCase.execute({
        userId: principal.userId,
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
      });

      setRefreshCookie(response, result.session.refreshToken, result.session.refreshExpiresAt);
      await this.audit(request, {
        actor: { id: principal.userId, type: principal.type },
        action: 'auth.change-password',
        outcome: 'success',
        statusCode: 200,
      });

      return AuthSessionResponseDto.fromResult(result);
    } catch (error) {
      await this.audit(request, {
        actor: { id: principal.userId, type: principal.type },
        action: 'auth.change-password',
        outcome: 'failure',
        statusCode: activityStatusOf(error),
      });

      throw error;
    }
  }

  private async audit(
    request: Request,
    event: {
      actor: ActivityActorRef;
      action: string;
      outcome: ActivityOutcome;
      statusCode: number | null;
    },
  ): Promise<void> {
    await this.activity.record({
      actor: event.actor,
      action: event.action,
      module: 'auth',
      outcome: event.outcome,
      statusCode: event.statusCode,
      method: 'POST',
      path: request.path,
      route: routePatternOf(request),
      ip: request.ip ?? request.socket?.remoteAddress ?? null,
      userAgent: userAgentOf(request),
    });
  }
}

function routePatternOf(request: Request): string | null {
  const route = (request as unknown as { route?: { path?: unknown } }).route;

  return typeof route?.path === 'string' ? route.path : null;
}

function userAgentOf(request: Request): string | null {
  const header = request.headers['user-agent'];

  if (typeof header === 'string') {
    return header;
  }

  return Array.isArray(header) ? (header[0] ?? null) : null;
}

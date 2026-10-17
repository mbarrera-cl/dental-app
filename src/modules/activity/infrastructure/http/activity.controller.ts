import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentPrincipal } from '../../../../shared/security/current-principal.decorator.js';
import type { AuthenticatedRequest } from '../../../../shared/security/authenticated-request.js';
import type { Principal } from '../../../../shared/security/principal.js';
import { RequirePermissions } from '../../../../shared/security/require-permissions.decorator.js';
import { GetActivityConfigUseCase } from '../../application/use-cases/get-activity-config.use-case.js';
import { ListActivitiesUseCase } from '../../application/use-cases/list-activities.use-case.js';
import { PurgeActivitiesUseCase } from '../../application/use-cases/purge-activities.use-case.js';
import type { ActivityOutcome } from '../../domain/activity-entry.js';
import { activityPermissions } from '../../permissions.js';
import { ActivitySkip } from './activity-action.decorator.js';
import {
  ActivityPageResponseDto,
} from './dtos/activity-entry.response.dto.js';
import {
  PurgeActivityRequestDto,
  PurgePreviewResponseDto,
  PurgeResultResponseDto,
} from './dtos/purge-activity.request.dto.js';

/**
 * Driving adapter of the activity trail: read-only listing with filters and
 * the audited purge. Entries are written by `ActivityInterceptor` and the
 * auth adapter — never through HTTP.
 */
@ApiTags('activity')
@Controller('activity')
@ActivitySkip()
export class ActivityController {
  constructor(
    private readonly listActivities: ListActivitiesUseCase,
    private readonly getConfig: GetActivityConfigUseCase,
    private readonly purgeActivities: PurgeActivitiesUseCase,
  ) {}

  @Get()
  @RequirePermissions(activityPermissions.read)
  @ApiOperation({
    summary: 'List activity, newest first (own entries unless the caller may read everyone)',
  })
  @ApiOkResponse({ type: ActivityPageResponseDto })
  async findAll(
    @CurrentPrincipal() principal: Principal,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('action') action?: string,
    @Query('module') module?: string,
    @Query('actorId') actorId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('subjectType') subjectType?: string,
    @Query('subjectId') subjectId?: string,
    @Query('outcome') outcome?: string,
  ): Promise<ActivityPageResponseDto> {
    const canReadAll = principal.permissions.has(activityPermissions.readAll);
    const [page, config] = await Promise.all([
      this.listActivities.execute({
        limit: limit === undefined ? undefined : Number.parseInt(limit, 10),
        cursor: cursor ?? null,
        action: action ?? null,
        module: module ?? null,
        actorId: actorId ?? null,
        from: from ?? null,
        to: to ?? null,
        subjectType: subjectType ?? null,
        subjectId: subjectId ?? null,
        outcome: parseOutcome(outcome),
        scopeActorId: canReadAll ? null : principal.userId,
      }),
      this.getConfig.execute(),
    ]);

    return ActivityPageResponseDto.fromDomain(page, config);
  }

  @Get('purge/preview')
  @RequirePermissions(activityPermissions.purge)
  @ApiOperation({ summary: 'Count the entries a purge would delete' })
  @ApiOkResponse({ type: PurgePreviewResponseDto })
  @ApiForbiddenResponse({ description: 'The caller cannot purge activity.' })
  async previewPurge(
    @Query('all') all?: string,
    @Query('before') before?: string,
  ): Promise<PurgePreviewResponseDto> {
    const count = await this.purgeActivities.preview({
      all: all === 'true' || all === '1',
      before: before ?? null,
    });

    return { count };
  }

  @Post('purge')
  @RequirePermissions(activityPermissions.purge)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete activity entries (audited; cannot be undone)' })
  @ApiOkResponse({ type: PurgeResultResponseDto })
  @ApiBadRequestResponse({ description: 'The scope is missing or the date is invalid.' })
  @ApiForbiddenResponse({ description: 'The caller cannot purge activity.' })
  async purge(
    @Body() body: PurgeActivityRequestDto,
    @CurrentPrincipal() principal: Principal,
    @Req() request: AuthenticatedRequest,
  ): Promise<PurgeResultResponseDto> {
    const result = await this.purgeActivities.execute({
      all: body.all === true,
      before: body.before ?? null,
      actor: { id: principal.userId, type: principal.type },
      ip: request.ip ?? request.socket?.remoteAddress ?? null,
      userAgent: userAgentOf(request),
    });

    return { deleted: result.deleted, at: result.at };
  }
}

function parseOutcome(value: string | undefined): ActivityOutcome | null {
  return value === 'success' || value === 'failure' ? value : null;
}

function userAgentOf(request: AuthenticatedRequest): string | null {
  const header = request.headers['user-agent'];

  if (typeof header === 'string') {
    return header;
  }

  return Array.isArray(header) ? (header[0] ?? null) : null;
}

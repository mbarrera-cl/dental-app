import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentPrincipal } from '../../../../shared/security/current-principal.decorator.js';
import type { Principal } from '../../../../shared/security/principal.js';
import { RequirePermissions } from '../../../../shared/security/require-permissions.decorator.js';
import { ActivityAction } from '../../../activity/infrastructure/http/activity-action.decorator.js';
import { SettingsAuditService } from '../../application/settings-audit.service.js';
import { ExportSettingsUseCase } from '../../application/use-cases/export-settings.use-case.js';
import { GetSettingsUseCase } from '../../application/use-cases/get-settings.use-case.js';
import { ImportSettingsUseCase } from '../../application/use-cases/import-settings.use-case.js';
import { UpdateSettingsUseCase } from '../../application/use-cases/update-settings.use-case.js';
import type { SettingsAuditActor, SettingsAuditEntry } from '../../domain/settings-audit.js';
import type { SettingsExportEnvelope } from '../../domain/settings-export.js';
import { settingsPermissions } from '../../permissions.js';
import { SettingResponseDto } from './dtos/setting-response.dto.js';
import { UpdateSettingsRequestDto } from './dtos/update-settings.request.dto.js';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly getSettings: GetSettingsUseCase,
    private readonly updateSettings: UpdateSettingsUseCase,
    private readonly exportSettings: ExportSettingsUseCase,
    private readonly importSettings: ImportSettingsUseCase,
    private readonly auditTrail: SettingsAuditService,
  ) {}

  @Get()
  @RequirePermissions(settingsPermissions.read)
  @ApiOperation({ summary: 'List every setting with its value and metadata' })
  @ApiOkResponse({ type: [SettingResponseDto] })
  async findAll(): Promise<SettingResponseDto[]> {
    const overview = await this.getSettings.execute();

    return overview.map((setting) => SettingResponseDto.fromOverview(setting));
  }

  @Patch()
  @RequirePermissions(settingsPermissions.update)
  @ActivityAction({ action: 'settings.update' })
  @ApiOperation({ summary: 'Update settings (validated against the registry, all-or-nothing)' })
  @ApiOkResponse({ type: [SettingResponseDto], description: 'Every setting after the update.' })
  @ApiBadRequestResponse({ description: 'Unknown setting key or invalid value.' })
  async update(
    @Body() body: UpdateSettingsRequestDto,
    @CurrentPrincipal() principal: Principal,
  ): Promise<SettingResponseDto[]> {
    const overview = await this.updateSettings.execute({
      values: body.values,
      actor: actorOf(principal),
    });

    return overview.map((setting) => SettingResponseDto.fromOverview(setting));
  }

  @Get('export')
  @RequirePermissions(settingsPermissions.read)
  @ApiOperation({ summary: 'Export the editable configuration as a transferable JSON envelope' })
  @ApiOkResponse({ description: 'Settings envelope ready to POST back to /settings/import.' })
  async export(): Promise<SettingsExportEnvelope> {
    return this.exportSettings.execute();
  }

  @Post('import')
  @RequirePermissions(settingsPermissions.update)
  @ActivityAction({ action: 'settings.import' })
  @ApiOperation({
    summary: 'Import a configuration envelope (validated, all-or-nothing, audited)',
  })
  @ApiOkResponse({ type: [SettingResponseDto], description: 'Every setting after the import.' })
  @ApiBadRequestResponse({ description: 'Malformed envelope, unknown key or invalid value.' })
  async import(
    @Body() body: unknown,
    @CurrentPrincipal() principal: Principal,
  ): Promise<SettingResponseDto[]> {
    const overview = await this.importSettings.execute({
      envelope: body,
      actor: actorOf(principal),
    });

    return overview.map((setting) => SettingResponseDto.fromOverview(setting));
  }

  @Get('audit')
  @RequirePermissions(settingsPermissions.read)
  @ApiOperation({ summary: 'Latest configuration changes, newest first' })
  @ApiOkResponse({ description: 'Audit entries with the actor and the effective diff.' })
  async audit(@Query('limit') limit?: string): Promise<SettingsAuditEntry[]> {
    return this.auditTrail.list(limit === undefined ? undefined : Number.parseInt(limit, 10));
  }
}

/** The principal is all the audit trail needs: id, kind and the diff. */
function actorOf(principal: Principal): SettingsAuditActor {
  return { id: principal.userId, type: principal.type };
}

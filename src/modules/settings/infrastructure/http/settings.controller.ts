import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../../../../shared/security/require-permissions.decorator.js';
import { GetSettingsUseCase } from '../../application/use-cases/get-settings.use-case.js';
import { UpdateSettingsUseCase } from '../../application/use-cases/update-settings.use-case.js';
import { settingsPermissions } from '../../permissions.js';
import { SettingResponseDto } from './dtos/setting-response.dto.js';
import { UpdateSettingsRequestDto } from './dtos/update-settings.request.dto.js';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly getSettings: GetSettingsUseCase,
    private readonly updateSettings: UpdateSettingsUseCase,
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
  @ApiOperation({ summary: 'Update settings (validated against the registry, all-or-nothing)' })
  @ApiOkResponse({ type: [SettingResponseDto], description: 'Every setting after the update.' })
  @ApiBadRequestResponse({ description: 'Unknown setting key or invalid value.' })
  async update(@Body() body: UpdateSettingsRequestDto): Promise<SettingResponseDto[]> {
    const overview = await this.updateSettings.execute({ values: body.values });

    return overview.map((setting) => SettingResponseDto.fromOverview(setting));
  }
}

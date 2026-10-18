import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../../../shared/security/require-permissions.decorator.js';
import { dashboardCategory } from '../../../../shared/security/permissions.js';
import { GetDashboardSummaryUseCase } from '../../application/use-cases/get-dashboard-summary.use-case.js';
import { DashboardSummaryResponseDto } from './dtos/dashboard-summary.response.dto.js';

/**
 * Read-only dashboard aggregates. One endpoint so every card shares the same
 * server-computed day/month window; nothing here writes.
 */
@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly getSummary: GetDashboardSummaryUseCase) {}

  @Get('summary')
  @RequirePermissions(dashboardCategory.keys.read)
  @ApiOperation({
    summary: 'Aggregated indicators for the dashboard (patients, cash, quotes, agenda, activity)',
  })
  @ApiOkResponse({ type: DashboardSummaryResponseDto })
  async summary(): Promise<DashboardSummaryResponseDto> {
    const summary = await this.getSummary.execute({});

    return DashboardSummaryResponseDto.fromDomain(summary);
  }
}

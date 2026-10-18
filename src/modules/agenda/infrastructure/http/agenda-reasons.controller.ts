import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentPrincipal } from '../../../../shared/security/current-principal.decorator.js';
import type { Principal } from '../../../../shared/security/principal.js';
import { RequirePermissions } from '../../../../shared/security/require-permissions.decorator.js';
import { ActivityAction } from '../../../activity/infrastructure/http/activity-action.decorator.js';
import { agendaPermissions } from '../../permissions.js';
import { CreateAgendaReasonUseCase } from '../../application/use-cases/create-agenda-reason.use-case.js';
import { DeleteAgendaReasonUseCase } from '../../application/use-cases/delete-agenda-reason.use-case.js';
import { ListAgendaReasonsUseCase } from '../../application/use-cases/list-agenda-reasons.use-case.js';
import { UpdateAgendaReasonUseCase } from '../../application/use-cases/update-agenda-reason.use-case.js';
import { AgendaReasonRequestDto } from './dtos/agenda-reason.request.dto.js';
import { AgendaReasonResponseDto } from './dtos/agenda-reason.response.dto.js';

@ApiTags('agenda')
@Controller('agenda/reasons')
export class AgendaReasonsController {
  constructor(
    private readonly listReasons: ListAgendaReasonsUseCase,
    private readonly createReason: CreateAgendaReasonUseCase,
    private readonly updateReason: UpdateAgendaReasonUseCase,
    private readonly deleteReason: DeleteAgendaReasonUseCase,
  ) {}

  @Get()
  @RequirePermissions(agendaPermissions.read)
  @ApiOperation({ summary: 'List appointment reasons' })
  @ApiOkResponse({ type: [AgendaReasonResponseDto] })
  async list(): Promise<AgendaReasonResponseDto[]> {
    const reasons = await this.listReasons.execute();
    return reasons.map(AgendaReasonResponseDto.fromDomain);
  }

  @Post()
  @RequirePermissions(agendaPermissions.manage)
  @ActivityAction({ action: 'agenda.reason.create', subjectType: 'agenda-reason' })
  @ApiOperation({ summary: 'Create an appointment reason' })
  @ApiCreatedResponse({ type: AgendaReasonResponseDto })
  async create(
    @Body() body: AgendaReasonRequestDto,
    @CurrentPrincipal() principal: Principal,
  ): Promise<AgendaReasonResponseDto> {
    const reason = await this.createReason.execute({ name: body.name, actorId: principal.userId });
    return AgendaReasonResponseDto.fromDomain(reason);
  }

  @Patch(':id')
  @RequirePermissions(agendaPermissions.manage)
  @ActivityAction({
    action: 'agenda.reason.update',
    subjectType: 'agenda-reason',
    subjectParam: 'id',
  })
  @ApiOperation({ summary: 'Rename an appointment reason' })
  @ApiOkResponse({ type: AgendaReasonResponseDto })
  async update(
    @Param('id') id: string,
    @Body() body: AgendaReasonRequestDto,
    @CurrentPrincipal() principal: Principal,
  ): Promise<AgendaReasonResponseDto> {
    const reason = await this.updateReason.execute({
      id,
      name: body.name,
      actorId: principal.userId,
    });
    return AgendaReasonResponseDto.fromDomain(reason);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(agendaPermissions.manage)
  @ActivityAction({
    action: 'agenda.reason.delete',
    subjectType: 'agenda-reason',
    subjectParam: 'id',
  })
  @ApiOperation({ summary: 'Delete an appointment reason' })
  @ApiNoContentResponse({ description: 'The reason was deleted.' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.deleteReason.execute(id);
  }
}

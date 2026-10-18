import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentPrincipal } from '../../../../shared/security/current-principal.decorator.js';
import type { Principal } from '../../../../shared/security/principal.js';
import { RequirePermissions } from '../../../../shared/security/require-permissions.decorator.js';
import { ActivityAction } from '../../../activity/infrastructure/http/activity-action.decorator.js';
import { AddTreatmentPlanItemUseCase } from '../../application/use-cases/add-treatment-plan-item.use-case.js';
import { GetTreatmentPlanUseCase } from '../../application/use-cases/get-treatment-plan.use-case.js';
import { UpdateTreatmentPlanItemUseCase } from '../../application/use-cases/update-treatment-plan-item.use-case.js';
import { clinicalPermissions } from '../../permissions.js';
import { AddTreatmentPlanItemRequestDto } from './dtos/add-treatment-plan-item.request.dto.js';
import { TreatmentPlanItemResponseDto } from './dtos/treatment-plan-item.response.dto.js';
import { TreatmentPlanResponseDto } from './dtos/treatment-plan.response.dto.js';
import { UpdateTreatmentPlanItemRequestDto } from './dtos/update-treatment-plan-item.request.dto.js';

/**
 * Driving adapter for the treatment plan of a dental clinical record. It is
 * part of the clinical context (reuses the ficha's permissions and audit
 * events); a plan is created lazily on first access.
 */
@ApiTags('clinical')
@Controller()
export class TreatmentPlanController {
  constructor(
    private readonly getPlan: GetTreatmentPlanUseCase,
    private readonly addItem: AddTreatmentPlanItemUseCase,
    private readonly updateItem: UpdateTreatmentPlanItemUseCase,
  ) {}

  @Get('clinical-records/:recordId/treatment-plan')
  @RequirePermissions(clinicalPermissions.read)
  @ApiOperation({ summary: 'Get the treatment plan of a clinical record' })
  @ApiOkResponse({ type: TreatmentPlanResponseDto })
  @ApiNotFoundResponse({
    description: 'No clinical record with this id exists.',
  })
  async findPlan(
    @Param('recordId') recordId: string,
  ): Promise<TreatmentPlanResponseDto> {
    const view = await this.getPlan.execute({ recordId });

    return TreatmentPlanResponseDto.fromDomain(view);
  }

  @Post('clinical-records/:recordId/treatment-plan/items')
  @RequirePermissions(clinicalPermissions.update)
  @ActivityAction({
    action: 'clinical.add-plan-item',
    subjectType: 'clinical-record',
    subjectParam: 'recordId',
  })
  @ApiOperation({ summary: 'Add an entry to the treatment plan' })
  @ApiCreatedResponse({ type: TreatmentPlanItemResponseDto })
  @ApiBadRequestResponse({ description: 'The payload failed validation.' })
  @ApiNotFoundResponse({
    description: 'No clinical record with this id exists.',
  })
  async createItem(
    @Param('recordId') recordId: string,
    @Body() body: AddTreatmentPlanItemRequestDto,
    @CurrentPrincipal() principal: Principal,
  ): Promise<TreatmentPlanItemResponseDto> {
    const item = await this.addItem.execute({
      recordId,
      actorId: principal.userId,
      tooth: body.tooth,
      procedure: body.procedure,
      ucoCode: body.ucoCode,
      notes: body.notes,
    });

    return TreatmentPlanItemResponseDto.fromDomain(item);
  }

  @Patch('treatment-plan-items/:id')
  @RequirePermissions(clinicalPermissions.update)
  @ActivityAction({
    action: 'clinical.update-plan-item',
    subjectType: 'treatment-plan-item',
    subjectParam: 'id',
  })
  @ApiOperation({
    summary: 'Update a treatment plan entry (status and/or details)',
  })
  @ApiOkResponse({ type: TreatmentPlanItemResponseDto })
  @ApiBadRequestResponse({
    description: 'The payload failed validation or is empty.',
  })
  @ApiNotFoundResponse({
    description: 'No treatment plan item with this id exists.',
  })
  async patchItem(
    @Param('id') id: string,
    @Body() body: UpdateTreatmentPlanItemRequestDto,
    @CurrentPrincipal() principal: Principal,
  ): Promise<TreatmentPlanItemResponseDto> {
    const item = await this.updateItem.execute({
      itemId: id,
      actorId: principal.userId,
      status: body.status,
      tooth: body.tooth,
      procedure: body.procedure,
      ucoCode: body.ucoCode,
      notes: body.notes,
    });

    return TreatmentPlanItemResponseDto.fromDomain(item);
  }
}

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
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
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
import { quotesPermissions } from '../../../quotes/permissions.js';
import { DeleteTreatmentPlanItemUseCase } from '../../application/use-cases/delete-treatment-plan-item.use-case.js';
import { GetTreatmentPlanUseCase } from '../../application/use-cases/get-treatment-plan.use-case.js';
import { ImportQuoteIntoTreatmentPlanUseCase } from '../../application/use-cases/import-quote-into-treatment-plan.use-case.js';
import { PreviewQuoteImportUseCase } from '../../application/use-cases/preview-quote-import.use-case.js';
import { RestoreTreatmentPlanItemUseCase } from '../../application/use-cases/restore-treatment-plan-item.use-case.js';
import { UpdateTreatmentPlanItemUseCase } from '../../application/use-cases/update-treatment-plan-item.use-case.js';
import { UpdateTreatmentPlanNotesUseCase } from '../../application/use-cases/update-treatment-plan-notes.use-case.js';
import { clinicalPermissions } from '../../permissions.js';
import { QuoteImportPreviewResponseDto } from './dtos/quote-import-preview.response.dto.js';
import { TreatmentPlanItemResponseDto } from './dtos/treatment-plan-item.response.dto.js';
import {
  DeleteTreatmentPlanItemRequestDto,
  ImportQuoteRequestDto,
  UpdateTreatmentPlanNotesRequestDto,
} from './dtos/treatment-plan-requests.dto.js';
import { TreatmentPlanResponseDto } from './dtos/treatment-plan.response.dto.js';
import { UpdateTreatmentPlanItemRequestDto } from './dtos/update-treatment-plan-item.request.dto.js';

/**
 * Driving adapter for the treatment plan of a dental clinical record. It is
 * part of the clinical context (reuses the ficha's permissions and audit
 * events); a plan is created lazily on first access. Items are only ever
 * imported from an approved quotation, never added by hand.
 */
@ApiTags('clinical')
@Controller()
export class TreatmentPlanController {
  constructor(
    private readonly getPlan: GetTreatmentPlanUseCase,
    private readonly updateItem: UpdateTreatmentPlanItemUseCase,
    private readonly deletePlanItem: DeleteTreatmentPlanItemUseCase,
    private readonly restorePlanItem: RestoreTreatmentPlanItemUseCase,
    private readonly updateNotes: UpdateTreatmentPlanNotesUseCase,
    private readonly previewImport: PreviewQuoteImportUseCase,
    private readonly importQuote: ImportQuoteIntoTreatmentPlanUseCase,
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
    @Query('deleted') deleted?: string,
  ): Promise<TreatmentPlanResponseDto> {
    const view = await this.getPlan.execute({
      recordId,
      deleted: deleted === 'true',
    });

    return TreatmentPlanResponseDto.fromDomain(view);
  }

  @Patch('treatment-plan-items/:id')
  @RequirePermissions(clinicalPermissions.update)
  @ActivityAction({
    action: 'clinical.update-plan-item',
    subjectType: 'treatment-plan-item',
    subjectParam: 'id',
  })
  @ApiOperation({
    summary: 'Update a treatment plan entry (status, details and/or note)',
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

  @Delete('treatment-plan-items/:id')
  @RequirePermissions(clinicalPermissions.update)
  @ActivityAction({
    action: 'clinical.delete-plan-item',
    subjectType: 'treatment-plan-item',
    subjectParam: 'id',
  })
  @ApiOperation({ summary: 'Move a treatment plan entry to the trash' })
  @ApiOkResponse({ type: TreatmentPlanItemResponseDto })
  @ApiConflictResponse({ description: 'The item is already in the trash.' })
  async deleteItem(
    @Param('id') id: string,
    @Body() body: DeleteTreatmentPlanItemRequestDto,
    @CurrentPrincipal() principal: Principal,
  ): Promise<TreatmentPlanItemResponseDto> {
    const item = await this.deletePlanItem.execute({
      itemId: id,
      actorId: principal.userId,
      reason: body.reason,
    });

    return TreatmentPlanItemResponseDto.fromDomain(item);
  }

  @Post('treatment-plan-items/:id/restore')
  @RequirePermissions(clinicalPermissions.update)
  @ActivityAction({
    action: 'clinical.restore-plan-item',
    subjectType: 'treatment-plan-item',
    subjectParam: 'id',
  })
  @ApiOperation({ summary: 'Restore a treatment plan entry from the trash' })
  @ApiOkResponse({ type: TreatmentPlanItemResponseDto })
  @ApiConflictResponse({ description: 'The item is not in the trash.' })
  async restoreItem(
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<TreatmentPlanItemResponseDto> {
    const item = await this.restorePlanItem.execute({
      itemId: id,
      actorId: principal.userId,
    });

    return TreatmentPlanItemResponseDto.fromDomain(item);
  }

  @Patch('clinical-records/:recordId/treatment-plan/notes')
  @RequirePermissions(clinicalPermissions.update)
  @ActivityAction({
    action: 'clinical.update-plan-notes',
    subjectType: 'clinical-record',
    subjectParam: 'recordId',
  })
  @ApiOperation({ summary: 'Replace the rich-text note of the plan' })
  @ApiOkResponse({ type: TreatmentPlanResponseDto })
  async patchNotes(
    @Param('recordId') recordId: string,
    @Body() body: UpdateTreatmentPlanNotesRequestDto,
    @CurrentPrincipal() principal: Principal,
  ): Promise<TreatmentPlanResponseDto> {
    await this.updateNotes.execute({
      recordId,
      actorId: principal.userId,
      notes: body.notes,
    });

    const view = await this.getPlan.execute({ recordId });

    return TreatmentPlanResponseDto.fromDomain(view);
  }

  @Post('clinical-records/:recordId/treatment-plan/import/preview')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(clinicalPermissions.update, quotesPermissions.read)
  @ApiOperation({
    summary: 'Preview importing an approved quotation (flags per line)',
  })
  @ApiOkResponse({ type: QuoteImportPreviewResponseDto })
  async previewImportQuote(
    @Param('recordId') recordId: string,
    @Body() body: ImportQuoteRequestDto,
  ): Promise<QuoteImportPreviewResponseDto> {
    const preview = await this.previewImport.execute({
      recordId,
      quoteId: body.quoteId,
    });

    return QuoteImportPreviewResponseDto.fromDomain(preview);
  }

  @Post('clinical-records/:recordId/treatment-plan/import')
  @RequirePermissions(clinicalPermissions.update, quotesPermissions.read)
  @ActivityAction({
    action: 'clinical.import-plan-items',
    subjectType: 'clinical-record',
    subjectParam: 'recordId',
  })
  @ApiOperation({ summary: 'Import an approved quotation into the plan' })
  @ApiCreatedResponse({ type: [TreatmentPlanItemResponseDto] })
  async importQuoteIntoPlan(
    @Param('recordId') recordId: string,
    @Body() body: ImportQuoteRequestDto,
    @CurrentPrincipal() principal: Principal,
  ): Promise<TreatmentPlanItemResponseDto[]> {
    const items = await this.importQuote.execute({
      recordId,
      quoteId: body.quoteId,
      itemIds: body.itemIds,
      actorId: principal.userId,
    });

    return items.map((item) => TreatmentPlanItemResponseDto.fromDomain(item));
  }
}

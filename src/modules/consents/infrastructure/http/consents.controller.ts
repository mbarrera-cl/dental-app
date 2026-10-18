import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentPrincipal } from '../../../../shared/security/current-principal.decorator.js';
import type { Principal } from '../../../../shared/security/principal.js';
import { RequirePermissions } from '../../../../shared/security/require-permissions.decorator.js';
import { ActivityAction } from '../../../activity/infrastructure/http/activity-action.decorator.js';
import { GetConsentUseCase } from '../../application/use-cases/get-consent.use-case.js';
import { ListConsentTemplatesUseCase } from '../../application/use-cases/list-consent-templates.use-case.js';
import { ListPatientConsentsUseCase } from '../../application/use-cases/list-patient-consents.use-case.js';
import { RecordConsentUseCase } from '../../application/use-cases/record-consent.use-case.js';
import { UpsertConsentTemplateUseCase } from '../../application/use-cases/upsert-consent-template.use-case.js';
import { consentsPermissions } from '../../permissions.js';
import { ConsentRecordResponseDto } from './dtos/consent-record.response.dto.js';
import { ConsentTemplateResponseDto } from './dtos/consent-template.response.dto.js';
import { RecordConsentRequestDto } from './dtos/record-consent.request.dto.js';
import { UpsertConsentTemplateRequestDto } from './dtos/upsert-consent-template.request.dto.js';

/**
 * Driving adapter for informed consents: template management plus the
 * append-only acceptance records of each patient.
 */
@ApiTags('consents')
@Controller()
export class ConsentsController {
  constructor(
    private readonly listTemplates: ListConsentTemplatesUseCase,
    private readonly upsertTemplate: UpsertConsentTemplateUseCase,
    private readonly recordConsent: RecordConsentUseCase,
    private readonly listConsents: ListPatientConsentsUseCase,
    private readonly getConsent: GetConsentUseCase,
  ) {}

  @Get('consents/templates')
  @RequirePermissions(consentsPermissions.read)
  @ApiOperation({ summary: 'List informed-consent templates' })
  @ApiQuery({ name: 'includeInactive', required: false })
  @ApiOkResponse({ type: [ConsentTemplateResponseDto] })
  async findAllTemplates(
    @Query('includeInactive') includeInactive?: string,
  ): Promise<ConsentTemplateResponseDto[]> {
    const templates = await this.listTemplates.execute({
      includeInactive: includeInactive === 'true',
    });

    return templates.map((template) =>
      ConsentTemplateResponseDto.fromDomain(template),
    );
  }

  @Put('consents/templates')
  @RequirePermissions(consentsPermissions.manage)
  @ActivityAction({
    action: 'consents.template.upsert',
    subjectType: 'consent-template',
    subjectLabel: (body) => {
      if (typeof body !== 'object' || body === null) {
        return null;
      }

      const key = (body as Record<string, unknown>)['key'];

      return typeof key === 'string' ? key : null;
    },
  })
  @ApiOperation({ summary: 'Create or edit a consent template by key' })
  @ApiOkResponse({ type: ConsentTemplateResponseDto })
  @ApiBadRequestResponse({ description: 'The payload failed validation.' })
  async upsert(
    @Body() body: UpsertConsentTemplateRequestDto,
  ): Promise<ConsentTemplateResponseDto> {
    const template = await this.upsertTemplate.execute({
      key: body.key,
      title: body.title,
      body: body.body,
      active: body.active,
    });

    return ConsentTemplateResponseDto.fromDomain(template);
  }

  @Post('patients/:patientId/consents')
  @RequirePermissions(consentsPermissions.record)
  @ActivityAction({
    action: 'consents.record',
    subjectType: 'patient',
    subjectParam: 'patientId',
  })
  @ApiOperation({ summary: 'Record a simple digital acceptance' })
  @ApiCreatedResponse({ type: ConsentRecordResponseDto })
  @ApiBadRequestResponse({ description: 'The payload failed validation.' })
  @ApiNotFoundResponse({ description: 'No patient or template with this identifier exists.' })
  async recordForPatient(
    @Param('patientId') patientId: string,
    @Body() body: RecordConsentRequestDto,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ConsentRecordResponseDto> {
    const record = await this.recordConsent.execute({
      patientId,
      templateKey: body.templateKey,
      procedure: body.procedure ?? null,
      acceptorName: body.acceptorName,
      actorId: principal.userId,
    });

    return ConsentRecordResponseDto.fromDomain(record);
  }

  @Get('patients/:patientId/consents')
  @RequirePermissions(consentsPermissions.read)
  @ApiOperation({ summary: 'List the consents accepted by a patient' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiOkResponse({ type: [ConsentRecordResponseDto] })
  async findAllForPatient(
    @Param('patientId') patientId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<ConsentRecordResponseDto[]> {
    const records = await this.listConsents.execute({
      patientId,
      limit: parseInteger(limit, 50),
      offset: parseInteger(offset, 0),
    });

    return records.map((record) => ConsentRecordResponseDto.fromDomain(record));
  }

  @Get('consents/:id')
  @RequirePermissions(consentsPermissions.read)
  @ActivityAction({
    action: 'consents.read',
    subjectType: 'consent-record',
    subjectParam: 'id',
  })
  @ApiOperation({ summary: 'Get one accepted consent by id' })
  @ApiOkResponse({ type: ConsentRecordResponseDto })
  @ApiNotFoundResponse({ description: 'No consent with this id exists.' })
  async findOne(@Param('id') id: string): Promise<ConsentRecordResponseDto> {
    const record = await this.getConsent.execute({ id });

    return ConsentRecordResponseDto.fromDomain(record);
  }
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) ? parsed : fallback;
}

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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
import { CreatePrescriptionUseCase } from '../../application/use-cases/create-prescription.use-case.js';
import { GetPrescriptionUseCase } from '../../application/use-cases/get-prescription.use-case.js';
import { ListPrescriptionsUseCase } from '../../application/use-cases/list-prescriptions.use-case.js';
import { prescriptionsPermissions } from '../../permissions.js';
import { CreatePrescriptionRequestDto } from './dtos/create-prescription.request.dto.js';
import { PrescriptionResponseDto } from './dtos/prescription.response.dto.js';

/**
 * Driving adapter for prescriptions (recetas). No business logic here:
 * validation lives in the domain and the use cases.
 */
@ApiTags('prescriptions')
@Controller()
export class PrescriptionsController {
  constructor(
    private readonly create: CreatePrescriptionUseCase,
    private readonly get: GetPrescriptionUseCase,
    private readonly list: ListPrescriptionsUseCase,
  ) {}

  @Post('patients/:patientId/prescriptions')
  @RequirePermissions(prescriptionsPermissions.create)
  @ActivityAction({
    action: 'prescriptions.create',
    subjectType: 'patient',
    subjectParam: 'patientId',
  })
  @ApiOperation({ summary: 'Issue a prescription for a patient' })
  @ApiCreatedResponse({ type: PrescriptionResponseDto })
  @ApiBadRequestResponse({ description: 'The payload failed validation.' })
  @ApiNotFoundResponse({ description: 'No patient with this id exists.' })
  async createForPatient(
    @Param('patientId') patientId: string,
    @Body() body: CreatePrescriptionRequestDto,
    @CurrentPrincipal() principal: Principal,
  ): Promise<PrescriptionResponseDto> {
    const prescription = await this.create.execute({
      patientId,
      items: body.items,
      indicaciones: body.indicaciones ?? null,
      actorId: principal.userId,
      actorName: principal.name,
    });

    return PrescriptionResponseDto.fromDomain(prescription);
  }

  @Get('patients/:patientId/prescriptions')
  @RequirePermissions(prescriptionsPermissions.read)
  @ApiOperation({ summary: 'List the latest prescriptions of a patient' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiOkResponse({ type: [PrescriptionResponseDto] })
  async findAllForPatient(
    @Param('patientId') patientId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<PrescriptionResponseDto[]> {
    const prescriptions = await this.list.execute({
      patientId,
      limit: parseInteger(limit, 50),
      offset: parseInteger(offset, 0),
    });

    return prescriptions.map((prescription) =>
      PrescriptionResponseDto.fromDomain(prescription),
    );
  }

  @Get('prescriptions/:id')
  @RequirePermissions(prescriptionsPermissions.read)
  @ActivityAction({
    action: 'prescriptions.read',
    subjectType: 'prescription',
    subjectParam: 'id',
  })
  @ApiOperation({ summary: 'Get a prescription by id' })
  @ApiOkResponse({ type: PrescriptionResponseDto })
  @ApiNotFoundResponse({ description: 'No prescription with this id exists.' })
  async findOne(@Param('id') id: string): Promise<PrescriptionResponseDto> {
    const prescription = await this.get.execute({ id });

    return PrescriptionResponseDto.fromDomain(prescription);
  }
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) ? parsed : fallback;
}

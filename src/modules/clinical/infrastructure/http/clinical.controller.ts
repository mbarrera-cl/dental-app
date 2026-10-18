import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
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
import { AddClinicalFindingUseCase } from '../../application/use-cases/add-clinical-finding.use-case.js';
import { CreateClinicalRecordUseCase } from '../../application/use-cases/create-clinical-record.use-case.js';
import { FinalizeClinicalRecordUseCase } from '../../application/use-cases/finalize-clinical-record.use-case.js';
import { GetClinicalIndicesUseCase } from '../../application/use-cases/get-clinical-indices.use-case.js';
import { GetClinicalRecordUseCase } from '../../application/use-cases/get-clinical-record.use-case.js';
import { GetPatientClinicalRecordUseCase } from '../../application/use-cases/get-patient-clinical-record.use-case.js';
import { ListClinicalEventsUseCase } from '../../application/use-cases/list-clinical-events.use-case.js';
import { ListClinicalFindingsUseCase } from '../../application/use-cases/list-clinical-findings.use-case.js';
import { UpdateClinicalRecordUseCase } from '../../application/use-cases/update-clinical-record.use-case.js';
import { VerifyClinicalRecordIntegrityUseCase } from '../../application/use-cases/verify-clinical-record-integrity.use-case.js';
import { VoidClinicalFindingUseCase } from '../../application/use-cases/void-clinical-finding.use-case.js';
import { clinicalPermissions } from '../../permissions.js';
import { AddClinicalFindingRequestDto } from './dtos/add-clinical-finding.request.dto.js';
import { ClinicalEventResponseDto } from './dtos/clinical-event.response.dto.js';
import { ClinicalFindingResponseDto } from './dtos/clinical-finding.response.dto.js';
import { ClinicalIndicesResponseDto } from './dtos/clinical-indices.response.dto.js';
import { ClinicalIntegrityResponseDto } from './dtos/clinical-integrity.response.dto.js';
import { ClinicalRecordResponseDto } from './dtos/clinical-record.response.dto.js';
import { CreateClinicalRecordRequestDto } from './dtos/create-clinical-record.request.dto.js';
import { UpdateClinicalRecordRequestDto } from './dtos/update-clinical-record.request.dto.js';

/**
 * Driving adapter: translates HTTP requests into clinical use case calls.
 * It contains no business logic — validation that matters (FDI teeth,
 * allowable symbols, ranges) lives in the domain and is enforced again here.
 */
@ApiTags('clinical')
@Controller()
export class ClinicalController {
  constructor(
    private readonly createRecord: CreateClinicalRecordUseCase,
    private readonly getRecord: GetClinicalRecordUseCase,
    private readonly getPatientRecord: GetPatientClinicalRecordUseCase,
    private readonly updateRecord: UpdateClinicalRecordUseCase,
    private readonly addFinding: AddClinicalFindingUseCase,
    private readonly listFindings: ListClinicalFindingsUseCase,
    private readonly voidFinding: VoidClinicalFindingUseCase,
    private readonly getIndices: GetClinicalIndicesUseCase,
    private readonly listEvents: ListClinicalEventsUseCase,
    private readonly finalizeRecord: FinalizeClinicalRecordUseCase,
    private readonly verifyIntegrity: VerifyClinicalRecordIntegrityUseCase,
  ) {}

  @Post('patients/:patientId/clinical-record')
  @RequirePermissions(clinicalPermissions.create)
  @ActivityAction({
    action: 'clinical.create',
    subjectType: 'patient',
    subjectParam: 'patientId',
  })
  @ApiOperation({ summary: 'Open the clinical record of a patient' })
  @ApiCreatedResponse({ type: ClinicalRecordResponseDto })
  @ApiBadRequestResponse({ description: 'The payload failed validation.' })
  @ApiNotFoundResponse({ description: 'No patient with this id exists.' })
  @ApiConflictResponse({
    description: 'The patient already has a clinical record.',
  })
  async createForPatient(
    @Param('patientId') patientId: string,
    @Body() body: CreateClinicalRecordRequestDto,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ClinicalRecordResponseDto> {
    const record = await this.createRecord.execute({
      patientId,
      actorId: principal.userId,
      categoria: body.categoria,
      embarazada: body.embarazada,
    });

    return ClinicalRecordResponseDto.fromDomain(record);
  }

  @Get('patients/:patientId/clinical-record')
  @RequirePermissions(clinicalPermissions.read)
  @ActivityAction({
    action: 'clinical.read',
    subjectType: 'patient',
    subjectParam: 'patientId',
  })
  @ApiOperation({ summary: 'Get the clinical record of a patient' })
  @ApiOkResponse({ type: ClinicalRecordResponseDto })
  @ApiNotFoundResponse({
    description: 'The patient has no clinical record yet.',
  })
  async findForPatient(
    @Param('patientId') patientId: string,
  ): Promise<ClinicalRecordResponseDto> {
    const record = await this.getPatientRecord.execute({ patientId });

    return ClinicalRecordResponseDto.fromDomain(record);
  }

  @Get('clinical-records/:id')
  @RequirePermissions(clinicalPermissions.read)
  @ActivityAction({
    action: 'clinical.read',
    subjectType: 'clinical-record',
    subjectParam: 'id',
  })
  @ApiOperation({ summary: 'Get a clinical record by id' })
  @ApiOkResponse({ type: ClinicalRecordResponseDto })
  @ApiNotFoundResponse({ description: 'No clinical record with this id exists.' })
  async findOne(@Param('id') id: string): Promise<ClinicalRecordResponseDto> {
    const record = await this.getRecord.execute({ id });

    return ClinicalRecordResponseDto.fromDomain(record);
  }

  @Patch('clinical-records/:id')
  @RequirePermissions(clinicalPermissions.update)
  @ActivityAction({
    action: 'clinical.update',
    subjectType: 'clinical-record',
    subjectParam: 'id',
  })
  @ApiOperation({ summary: 'Update a clinical record (partial)' })
  @ApiOkResponse({
    type: ClinicalRecordResponseDto,
    description: 'The updated record.',
  })
  @ApiBadRequestResponse({
    description: 'The payload failed validation or is empty.',
  })
  @ApiNotFoundResponse({ description: 'No clinical record with this id exists.' })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateClinicalRecordRequestDto,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ClinicalRecordResponseDto> {
    const record = await this.updateRecord.execute({
      id,
      actorId: principal.userId,
      categoria: body.categoria,
      embarazada: body.embarazada,
      motivoConsulta: body.motivoConsulta,
      enfermedadActual: body.enfermedadActual,
      antecedentes: body.antecedentes,
      signosVitales: body.signosVitales,
      examenEstomatognatico: body.examenEstomatognatico,
      indicadores: body.indicadores,
    });

    return ClinicalRecordResponseDto.fromDomain(record);
  }

  @Get('clinical-records/:id/findings')
  @RequirePermissions(clinicalPermissions.read)
  @ApiOperation({
    summary: 'List the odontogram findings of a clinical record',
    description: 'Full append-only log (voided entries included), oldest first.',
  })
  @ApiOkResponse({ type: [ClinicalFindingResponseDto] })
  @ApiNotFoundResponse({ description: 'No clinical record with this id exists.' })
  async findAllFindings(
    @Param('id') id: string,
  ): Promise<ClinicalFindingResponseDto[]> {
    const findings = await this.listFindings.execute({ recordId: id });

    return findings.map((finding) => ClinicalFindingResponseDto.fromDomain(finding));
  }

  @Post('clinical-records/:id/findings')
  @RequirePermissions(clinicalPermissions.update)
  @ActivityAction({
    action: 'clinical.add-finding',
    subjectType: 'clinical-record',
    subjectParam: 'id',
  })
  @ApiOperation({ summary: 'Add an odontogram finding' })
  @ApiCreatedResponse({ type: ClinicalFindingResponseDto })
  @ApiBadRequestResponse({
    description: 'Unknown tooth, surface or symbol.',
  })
  @ApiNotFoundResponse({ description: 'No clinical record with this id exists.' })
  async addFindingToRecord(
    @Param('id') id: string,
    @Body() body: AddClinicalFindingRequestDto,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ClinicalFindingResponseDto> {
    const finding = await this.addFinding.execute({
      recordId: id,
      actorId: principal.userId,
      tooth: body.tooth,
      surfaces: body.surfaces,
      symbol: body.symbol,
      recesion: body.recesion,
      movilidad: body.movilidad,
      note: body.note,
    });

    return ClinicalFindingResponseDto.fromDomain(finding);
  }

  @Post('clinical-records/:id/findings/:findingId/void')
  @RequirePermissions(clinicalPermissions.update)
  @ActivityAction({
    action: 'clinical.void-finding',
    subjectType: 'clinical-record',
    subjectParam: 'id',
  })
  @ApiOperation({ summary: 'Void an odontogram finding (undo, keeps history)' })
  @ApiOkResponse({ type: ClinicalFindingResponseDto })
  @ApiNotFoundResponse({ description: 'Record or finding not found.' })
  @ApiConflictResponse({ description: 'The finding is already voided.' })
  async voidFindingOfRecord(
    @Param('id') id: string,
    @Param('findingId') findingId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ClinicalFindingResponseDto> {
    const finding = await this.voidFinding.execute({
      recordId: id,
      findingId,
      actorId: principal.userId,
    });

    return ClinicalFindingResponseDto.fromDomain(finding);
  }

  @Get('clinical-records/:id/indices')
  @RequirePermissions(clinicalPermissions.read)
  @ApiOperation({
    summary: 'CPO/ceo indices and hygiene totals (derived)',
  })
  @ApiOkResponse({ type: ClinicalIndicesResponseDto })
  @ApiNotFoundResponse({ description: 'No clinical record with this id exists.' })
  async findIndices(@Param('id') id: string): Promise<ClinicalIndicesResponseDto> {
    const indices = await this.getIndices.execute({ recordId: id });

    return ClinicalIndicesResponseDto.fromDomain(indices);
  }

  @Get('clinical-records/:id/events')
  @RequirePermissions(clinicalPermissions.read)
  @ApiOperation({ summary: 'Clinical timeline / audit trail (newest first)' })
  @ApiOkResponse({ type: [ClinicalEventResponseDto] })
  @ApiNotFoundResponse({ description: 'No clinical record with this id exists.' })
  async findAllEvents(
    @Param('id') id: string,
  ): Promise<ClinicalEventResponseDto[]> {
    const events = await this.listEvents.execute({ recordId: id });

    return events.map((event) => ClinicalEventResponseDto.fromDomain(event));
  }

  @Post('clinical-records/:id/finalize')
  @RequirePermissions(clinicalPermissions.update)
  @ActivityAction({
    action: 'clinical.finalize',
    subjectType: 'clinical-record',
    subjectParam: 'id',
  })
  @ApiOperation({
    summary: 'Close (finalize) a clinical record',
    description: 'Seals the ficha with an integrity hash and locks it from further edits.',
  })
  @ApiOkResponse({ type: ClinicalRecordResponseDto })
  @ApiNotFoundResponse({ description: 'No clinical record with this id exists.' })
  async finalize(
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ClinicalRecordResponseDto> {
    const record = await this.finalizeRecord.execute({
      id,
      actorId: principal.userId,
    });

    return ClinicalRecordResponseDto.fromDomain(record);
  }

  @Get('clinical-records/:id/integrity')
  @RequirePermissions(clinicalPermissions.read)
  @ApiOperation({
    summary: 'Verify the integrity seal of a clinical record',
    description: 'Recomputes the hash over the record and its findings.',
  })
  @ApiOkResponse({ type: ClinicalIntegrityResponseDto })
  @ApiNotFoundResponse({ description: 'No clinical record with this id exists.' })
  async verifyIntegrityOfRecord(
    @Param('id') id: string,
  ): Promise<ClinicalIntegrityResponseDto> {
    const result = await this.verifyIntegrity.execute({ id });

    return ClinicalIntegrityResponseDto.fromDomain(result);
  }
}

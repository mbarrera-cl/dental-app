import {
  Body,
  Controller,
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
import { agendaPermissions } from '../../permissions.js';
import { CancelAppointmentUseCase } from '../../application/use-cases/cancel-appointment.use-case.js';
import { CheckConflictsUseCase } from '../../application/use-cases/check-conflicts.use-case.js';
import { GetAgendaConfigUseCase } from '../../application/use-cases/get-agenda-config.use-case.js';
import { CreateAppointmentUseCase } from '../../application/use-cases/create-appointment.use-case.js';
import { GetAgendaPatientUseCase } from '../../application/use-cases/get-agenda-patient.use-case.js';
import { GetAppointmentUseCase } from '../../application/use-cases/get-appointment.use-case.js';
import { ListAppointmentsUseCase } from '../../application/use-cases/list-appointments.use-case.js';
import { ListProfessionalsUseCase } from '../../application/use-cases/list-professionals.use-case.js';
import { SearchAgendaPatientsUseCase } from '../../application/use-cases/search-agenda-patients.use-case.js';
import { UpdateAppointmentUseCase } from '../../application/use-cases/update-appointment.use-case.js';
import { AgendaConfigResponseDto } from './dtos/agenda-config.response.dto.js';
import { AppointmentResponseDto } from './dtos/appointment.response.dto.js';
import { ConflictsQueryDto } from './dtos/conflicts.query.dto.js';
import { CreateAppointmentRequestDto } from './dtos/create-appointment.request.dto.js';
import { ListAppointmentsQueryDto } from './dtos/list-appointments.query.dto.js';
import { ProfessionalResponseDto } from './dtos/professional.response.dto.js';
import { SearchPatientsQueryDto } from './dtos/search-patients.query.dto.js';
import { UpdateAppointmentRequestDto } from './dtos/update-appointment.request.dto.js';

@ApiTags('agenda')
@Controller('agenda')
export class AgendaController {
  constructor(
    private readonly createAppointment: CreateAppointmentUseCase,
    private readonly updateAppointment: UpdateAppointmentUseCase,
    private readonly cancelAppointment: CancelAppointmentUseCase,
    private readonly getAppointment: GetAppointmentUseCase,
    private readonly listAppointments: ListAppointmentsUseCase,
    private readonly listProfessionals: ListProfessionalsUseCase,
    private readonly checkConflicts: CheckConflictsUseCase,
    private readonly getConfig: GetAgendaConfigUseCase,
    private readonly searchPatients: SearchAgendaPatientsUseCase,
    private readonly getPatient: GetAgendaPatientUseCase,
  ) {}

  @Get('config')
  @RequirePermissions(agendaPermissions.read)
  @ApiOperation({ summary: 'Agenda display and email settings' })
  @ApiOkResponse({ type: AgendaConfigResponseDto })
  async config(): Promise<AgendaConfigResponseDto> {
    return this.getConfig.execute();
  }

  @Get('patients')
  @RequirePermissions(agendaPermissions.read)
  @ApiOperation({ summary: 'Search patients for the agenda picker' })
  @ApiOkResponse({ description: 'Minimal patient summaries.' })
  async patients(@Query() query: SearchPatientsQueryDto) {
    return this.searchPatients.execute(query.query ?? '');
  }

  @Get('patients/:id')
  @RequirePermissions(agendaPermissions.read)
  @ApiOperation({ summary: 'Get one patient summary for the agenda picker' })
  async patient(@Param('id') id: string) {
    return this.getPatient.execute(id);
  }

  @Get('professionals')
  @RequirePermissions(agendaPermissions.read)
  @ApiOperation({ summary: 'List active users that can be assigned to appointments' })
  @ApiOkResponse({ type: [ProfessionalResponseDto] })
  async professionals(): Promise<ProfessionalResponseDto[]> {
    return this.listProfessionals.execute();
  }

  @Get('appointments')
  @RequirePermissions(agendaPermissions.read)
  @ApiOperation({ summary: 'List appointments in a date range' })
  @ApiOkResponse({ type: [AppointmentResponseDto] })
  async list(@Query() query: ListAppointmentsQueryDto): Promise<AppointmentResponseDto[]> {
    const views = await this.listAppointments.execute(query);
    return views.map((view) => AppointmentResponseDto.fromView(view));
  }

  @Get('conflicts')
  @RequirePermissions(agendaPermissions.create)
  @ApiOperation({ summary: 'Check overlapping appointments for a professional' })
  @ApiOkResponse({ type: [AppointmentResponseDto] })
  async conflicts(@Query() query: ConflictsQueryDto): Promise<AppointmentResponseDto[]> {
    const conflicts = await this.checkConflicts.execute(query);
    return conflicts.map((conflict) => {
      const dto = new AppointmentResponseDto();
      dto.warnings = [];
      dto.id = conflict.id;
      dto.startsAt = conflict.startsAt.toISOString();
      dto.endsAt = conflict.endsAt.toISOString();
      dto.patient = { id: '', nombreCompleto: conflict.patientName, rut: '', email: null };
      dto.professional = { id: query.professionalId, name: conflict.professionalName, email: '' };
      dto.status = 'scheduled';
      dto.reason = null;
      dto.notes = null;
      dto.location = null;
      dto.icsSequence = 0;
      dto.createdAt = conflict.startsAt.toISOString();
      dto.updatedAt = conflict.startsAt.toISOString();
      dto.cancelledAt = null;
      return dto;
    });
  }

  @Get('appointments/:id')
  @RequirePermissions(agendaPermissions.read)
  @ApiOperation({ summary: 'Get one appointment' })
  @ApiOkResponse({ type: AppointmentResponseDto })
  @ApiNotFoundResponse({ description: 'Unknown appointment.' })
  async get(@Param('id') id: string): Promise<AppointmentResponseDto> {
    return AppointmentResponseDto.fromView(await this.getAppointment.execute(id));
  }

  @Post('appointments')
  @RequirePermissions(agendaPermissions.create)
  @ActivityAction({ action: 'agenda.create', subjectType: 'appointment' })
  @ApiOperation({ summary: 'Create an appointment' })
  @ApiCreatedResponse({ type: AppointmentResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid range or unknown professional.' })
  @ApiNotFoundResponse({ description: 'Unknown patient or professional.' })
  async create(
    @Body() body: CreateAppointmentRequestDto,
    @CurrentPrincipal() principal: Principal,
  ): Promise<AppointmentResponseDto> {
    const result = await this.createAppointment.execute({
      patientId: body.patientId,
      professionalId: body.professionalId,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      reason: body.reason,
      notes: body.notes,
      location: body.location,
      actorId: principal.userId,
    });
    return AppointmentResponseDto.fromView(result.view, result.warnings);
  }

  @Patch('appointments/:id')
  @RequirePermissions(agendaPermissions.update)
  @ActivityAction({
    action: 'agenda.update',
    subjectType: 'appointment',
    subjectParam: 'id',
  })
  @ApiOperation({ summary: 'Edit or reschedule an appointment' })
  @ApiOkResponse({ type: AppointmentResponseDto })
  @ApiNotFoundResponse({ description: 'Unknown appointment.' })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateAppointmentRequestDto,
    @CurrentPrincipal() principal: Principal,
  ): Promise<AppointmentResponseDto> {
    const result = await this.updateAppointment.execute({
      id,
      patientId: body.patientId,
      professionalId: body.professionalId,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      reason: body.reason,
      notes: body.notes,
      location: body.location,
      actorId: principal.userId,
    });
    return AppointmentResponseDto.fromView(result.view, result.warnings);
  }

  @Post('appointments/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(agendaPermissions.cancel)
  @ActivityAction({
    action: 'agenda.cancel',
    subjectType: 'appointment',
    subjectParam: 'id',
  })
  @ApiOperation({ summary: 'Cancel an appointment' })
  @ApiOkResponse({ type: AppointmentResponseDto })
  @ApiNotFoundResponse({ description: 'Unknown appointment.' })
  async cancel(
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<AppointmentResponseDto> {
    return AppointmentResponseDto.fromView(
      await this.cancelAppointment.execute({ id, actorId: principal.userId }),
    );
  }
}

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
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreatePatientUseCase } from '../../application/use-cases/create-patient.use-case.js';
import { DeletePatientUseCase } from '../../application/use-cases/delete-patient.use-case.js';
import { GetPatientByRutUseCase } from '../../application/use-cases/get-patient-by-rut.use-case.js';
import { GetPatientUseCase } from '../../application/use-cases/get-patient.use-case.js';
import { ListPatientsUseCase } from '../../application/use-cases/list-patients.use-case.js';
import { UpdatePatientUseCase } from '../../application/use-cases/update-patient.use-case.js';
import { RequirePermissions } from '../../../../shared/security/require-permissions.decorator.js';
import { patientsPermissions } from '../../permissions.js';
import { CreatePatientRequestDto } from './dtos/create-patient.request.dto.js';
import { PatientResponseDto } from './dtos/patient-response.dto.js';
import { UpdatePatientRequestDto } from './dtos/update-patient.request.dto.js';

/**
 * Driving adapter: translates HTTP requests into use case calls and domain
 * objects back into HTTP responses. It contains no business logic.
 */
@ApiTags('patients')
@Controller('patients')
export class PatientsController {
  constructor(
    private readonly createPatient: CreatePatientUseCase,
    private readonly getPatient: GetPatientUseCase,
    private readonly getPatientByRut: GetPatientByRutUseCase,
    private readonly listPatients: ListPatientsUseCase,
    private readonly updatePatient: UpdatePatientUseCase,
    private readonly deletePatient: DeletePatientUseCase,
  ) {}

  @Post()
  @RequirePermissions(patientsPermissions.create)
  @ApiOperation({ summary: 'Create a patient' })
  @ApiCreatedResponse({
    type: PatientResponseDto,
    description: 'The patient was created.',
  })
  @ApiBadRequestResponse({ description: 'The payload failed validation.' })
  @ApiConflictResponse({
    description: 'A patient with this RUT already exists.',
  })
  async create(
    @Body() body: CreatePatientRequestDto,
  ): Promise<PatientResponseDto> {
    const patient = await this.createPatient.execute({
      rut: body.rut,
      nombres: body.nombres,
      apellidoPaterno: body.apellidoPaterno,
      apellidoMaterno: body.apellidoMaterno,
      fechaNacimiento: body.fechaNacimiento,
      sexo: body.sexo,
      email: body.email,
      telefono: body.telefono,
      direccion: body.direccion,
      prevision: body.prevision,
      contactoEmergencia: body.contactoEmergencia,
      notas: body.notas,
    });

    return PatientResponseDto.fromDomain(patient);
  }

  @Get()
  @RequirePermissions(patientsPermissions.read)
  @ApiOperation({ summary: 'List patients' })
  @ApiOkResponse({ type: [PatientResponseDto] })
  async findAll(): Promise<PatientResponseDto[]> {
    const patients = await this.listPatients.execute();

    return patients.map((patient) => PatientResponseDto.fromDomain(patient));
  }

  // Declared before `:id` on purpose: Express resolves routes in order and
  // this literal segment must win.
  @Get('rut/:rut')
  @RequirePermissions(patientsPermissions.read)
  @ApiOperation({ summary: 'Get a patient by RUT' })
  @ApiOkResponse({ type: PatientResponseDto })
  @ApiBadRequestResponse({ description: 'The RUT is malformed.' })
  @ApiNotFoundResponse({ description: 'No patient with this RUT exists.' })
  async findByRut(@Param('rut') rut: string): Promise<PatientResponseDto> {
    const patient = await this.getPatientByRut.execute({ rut });

    return PatientResponseDto.fromDomain(patient);
  }

  @Get(':id')
  @RequirePermissions(patientsPermissions.read)
  @ApiOperation({ summary: 'Get a patient by id' })
  @ApiOkResponse({ type: PatientResponseDto })
  @ApiNotFoundResponse({ description: 'No patient with this id exists.' })
  async findOne(@Param('id') id: string): Promise<PatientResponseDto> {
    const patient = await this.getPatient.execute({ id });

    return PatientResponseDto.fromDomain(patient);
  }

  @Patch(':id')
  @RequirePermissions(patientsPermissions.update)
  @ApiOperation({ summary: 'Update a patient (partial)' })
  @ApiOkResponse({
    type: PatientResponseDto,
    description: 'The updated patient.',
  })
  @ApiBadRequestResponse({
    description: 'The payload failed validation or is empty.',
  })
  @ApiNotFoundResponse({ description: 'No patient with this id exists.' })
  @ApiConflictResponse({ description: 'The new RUT is already taken.' })
  async update(
    @Param('id') id: string,
    @Body() body: UpdatePatientRequestDto,
  ): Promise<PatientResponseDto> {
    const patient = await this.updatePatient.execute({
      id,
      rut: body.rut,
      nombres: body.nombres,
      apellidoPaterno: body.apellidoPaterno,
      apellidoMaterno: body.apellidoMaterno,
      fechaNacimiento: body.fechaNacimiento,
      sexo: body.sexo,
      email: body.email,
      telefono: body.telefono,
      direccion: body.direccion,
      prevision: body.prevision,
      contactoEmergencia: body.contactoEmergencia,
      notas: body.notas,
    });

    return PatientResponseDto.fromDomain(patient);
  }

  @Delete(':id')
  @RequirePermissions(patientsPermissions.delete)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a patient' })
  @ApiNoContentResponse({ description: 'The patient was deleted.' })
  @ApiNotFoundResponse({ description: 'No patient with this id exists.' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.deletePatient.execute({ id });
  }
}

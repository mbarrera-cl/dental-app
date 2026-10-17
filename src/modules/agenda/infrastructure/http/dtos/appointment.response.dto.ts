import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { AppointmentView } from '../../../domain/appointment.models.js';
import type { AppointmentConflict } from '../../../domain/appointment.models.js';

class AppointmentPatientDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  nombreCompleto!: string;

  @ApiProperty()
  rut!: string;

  @ApiProperty({ nullable: true })
  email!: string | null;
}

class AppointmentProfessionalDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;
}

class AppointmentConflictDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  startsAt!: string;

  @ApiProperty()
  endsAt!: string;

  @ApiProperty()
  patientName!: string;

  @ApiProperty()
  professionalName!: string;
}

export class AppointmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: AppointmentPatientDto })
  patient!: AppointmentPatientDto;

  @ApiProperty({ type: AppointmentProfessionalDto })
  professional!: AppointmentProfessionalDto;

  @ApiProperty()
  startsAt!: string;

  @ApiProperty()
  endsAt!: string;

  @ApiProperty({ enum: ['scheduled', 'cancelled', 'completed', 'no_show'] })
  status!: string;

  @ApiPropertyOptional({ nullable: true })
  reason!: string | null;

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;

  @ApiPropertyOptional({ nullable: true })
  location!: string | null;

  @ApiProperty()
  icsSequence!: number;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiPropertyOptional({ nullable: true })
  cancelledAt!: string | null;

  @ApiProperty({ type: [AppointmentConflictDto] })
  warnings!: AppointmentConflictDto[];

  static fromView(view: AppointmentView, warnings: readonly AppointmentConflict[] = []): AppointmentResponseDto {
    const dto = new AppointmentResponseDto();
    const appointment = view.appointment;
    dto.id = appointment.id;
    dto.patient = {
      id: view.patient.id,
      nombreCompleto: view.patient.nombreCompleto,
      rut: view.patient.rut,
      email: view.patient.email,
    };
    dto.professional = view.professional;
    dto.startsAt = appointment.startsAt.toISOString();
    dto.endsAt = appointment.endsAt.toISOString();
    dto.status = appointment.status;
    dto.reason = appointment.reason;
    dto.notes = appointment.notes;
    dto.location = appointment.location;
    dto.icsSequence = appointment.icsSequence;
    dto.createdAt = appointment.createdAt.toISOString();
    dto.updatedAt = appointment.updatedAt.toISOString();
    dto.cancelledAt = appointment.cancelledAt?.toISOString() ?? null;
    dto.warnings = warnings.map((warning) => ({
      id: warning.id,
      startsAt: warning.startsAt.toISOString(),
      endsAt: warning.endsAt.toISOString(),
      patientName: warning.patientName,
      professionalName: warning.professionalName,
    }));
    return dto;
  }
}

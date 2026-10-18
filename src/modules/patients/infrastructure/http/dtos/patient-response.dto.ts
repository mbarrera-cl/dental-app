import { ApiProperty } from '@nestjs/swagger';
import type { ContactoEmergencia } from '../../../domain/contacto-emergencia.vo.js';
import type { Direccion } from '../../../domain/direccion.vo.js';
import type { Patient } from '../../../domain/patient.entity.js';
import type { Prevision } from '../../../domain/prevision.vo.js';

/**
 * Outbound DTOs: the HTTP representation of the domain objects. The static
 * mappers keep the translations in one place.
 */
export class DireccionResponseDto {
  @ApiProperty({ example: 'RM' })
  region: string;

  @ApiProperty({ example: 'Providencia' })
  comuna: string;

  @ApiProperty({ example: 'Av. Providencia' })
  calle: string;

  @ApiProperty({ example: '1234' })
  numero: string;

  @ApiProperty({ type: String, nullable: true, example: 'Depto 51' })
  departamento: string | null;

  static fromDomain(direccion: Direccion): DireccionResponseDto {
    const dto = new DireccionResponseDto();
    dto.region = direccion.region;
    dto.comuna = direccion.comuna;
    dto.calle = direccion.calle;
    dto.numero = direccion.numero;
    dto.departamento = direccion.departamento;
    return dto;
  }
}

export class PrevisionResponseDto {
  @ApiProperty({ example: 'FONASA' })
  tipo: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'B',
    description: 'FONASA only.',
  })
  tramo: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description: 'ISAPRE only.',
  })
  plan: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description: 'CONVENIO only.',
  })
  convenio: string | null;

  static fromDomain(prevision: Prevision): PrevisionResponseDto {
    const dto = new PrevisionResponseDto();
    dto.tipo = prevision.tipo;
    dto.tramo = prevision.tramo;
    dto.plan = prevision.plan;
    dto.convenio = prevision.convenio;
    return dto;
  }
}

export class ContactoEmergenciaResponseDto {
  @ApiProperty({ example: 'María Pérez' })
  nombre: string;

  @ApiProperty({ example: '+56987654321' })
  telefono: string;

  @ApiProperty({ type: String, nullable: true, example: 'Madre' })
  parentesco: string | null;

  static fromDomain(
    contacto: ContactoEmergencia,
  ): ContactoEmergenciaResponseDto {
    const dto = new ContactoEmergenciaResponseDto();
    dto.nombre = contacto.nombre;
    dto.telefono = contacto.telefono;
    dto.parentesco = contacto.parentesco;
    return dto;
  }
}

export class PatientResponseDto {
  @ApiProperty({ example: 'e0a7f6a4-2c2e-4d63-9c62-8d1f8f8f8f8f' })
  id: string;

  @ApiProperty({ example: '12345678-5', description: 'Canonical RUT.' })
  rut: string;

  @ApiProperty({ example: 'Camila' })
  nombres: string;

  @ApiProperty({ example: 'Rojas' })
  apellidoPaterno: string;

  @ApiProperty({ example: 'Pérez' })
  apellidoMaterno: string;

  @ApiProperty({ example: '1990-05-17', format: 'date' })
  fechaNacimiento: string;

  @ApiProperty({ example: 'femenino' })
  sexo: string;

  @ApiProperty({ type: String, nullable: true, example: 'camila@example.com' })
  email: string | null;

  @ApiProperty({ type: String, nullable: true, example: '+56912345678' })
  telefono: string | null;

  @ApiProperty({ type: DireccionResponseDto, nullable: true })
  direccion: DireccionResponseDto | null;

  @ApiProperty({ type: PrevisionResponseDto, nullable: true })
  prevision: PrevisionResponseDto | null;

  @ApiProperty({ type: ContactoEmergenciaResponseDto, nullable: true })
  contactoEmergencia: ContactoEmergenciaResponseDto | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Alergia a la penicilina',
  })
  notas: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'HC-000123',
    description: 'Clinical record number; assigned on create.',
  })
  numeroHistoria: string | null;

  @ApiProperty({ example: '2026-01-01T12:00:00.000Z', format: 'date-time' })
  createdAt: string;

  static fromDomain(patient: Patient): PatientResponseDto {
    const dto = new PatientResponseDto();
    dto.id = patient.id;
    dto.rut = patient.rut;
    dto.nombres = patient.nombres;
    dto.apellidoPaterno = patient.apellidoPaterno;
    dto.apellidoMaterno = patient.apellidoMaterno;
    dto.fechaNacimiento = patient.fechaNacimiento;
    dto.sexo = patient.sexo;
    dto.email = patient.email;
    dto.telefono = patient.telefono;
    dto.direccion =
      patient.direccion === null
        ? null
        : DireccionResponseDto.fromDomain(patient.direccion);
    dto.prevision =
      patient.prevision === null
        ? null
        : PrevisionResponseDto.fromDomain(patient.prevision);
    dto.contactoEmergencia =
      patient.contactoEmergencia === null
        ? null
        : ContactoEmergenciaResponseDto.fromDomain(patient.contactoEmergencia);
    dto.notas = patient.notas;
    dto.numeroHistoria = patient.numeroHistoria;
    dto.createdAt = patient.createdAt.toISOString();
    return dto;
  }
}

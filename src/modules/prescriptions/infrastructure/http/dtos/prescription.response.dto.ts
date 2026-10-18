import { ApiProperty } from '@nestjs/swagger';
import type {
  Prescription,
  PrescriptionItem,
} from '../../../domain/prescription.entity.js';

export class PrescriptionItemResponseDto {
  @ApiProperty({ example: 'Amoxicilina 500 mg' })
  medicamento: string;

  @ApiProperty({ example: '1 comprimido' })
  dosis: string;

  @ApiProperty({ example: 'Cada 8 horas' })
  frecuencia: string;

  @ApiProperty({ example: '7 días' })
  duracion: string;

  static fromDomain(item: PrescriptionItem): PrescriptionItemResponseDto {
    const dto = new PrescriptionItemResponseDto();
    dto.medicamento = item.medicamento;
    dto.dosis = item.dosis;
    dto.frecuencia = item.frecuencia;
    dto.duracion = item.duracion;
    return dto;
  }
}

export class PrescriptionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  patientId: string;

  @ApiProperty({ example: 'Camila Rojas Pérez' })
  patientName: string;

  @ApiProperty({ example: '12345678-5' })
  patientRut: string;

  @ApiProperty({ type: [PrescriptionItemResponseDto] })
  items: PrescriptionItemResponseDto[];

  @ApiProperty({ required: false, nullable: true })
  indicaciones: string | null;

  @ApiProperty({ required: false, nullable: true })
  issuedBy: string | null;

  @ApiProperty({ example: 'Dra. Carolina Soto' })
  issuedByName: string;

  @ApiProperty({ example: '2026-10-17T12:00:00.000Z' })
  issuedAt: string;

  @ApiProperty({ example: '2026-10-17T12:00:00.000Z' })
  createdAt: string;

  static fromDomain(prescription: Prescription): PrescriptionResponseDto {
    const dto = new PrescriptionResponseDto();
    dto.id = prescription.id;
    dto.patientId = prescription.patientId;
    dto.patientName = prescription.patientName;
    dto.patientRut = prescription.patientRut;
    dto.items = prescription.items.map((item) =>
      PrescriptionItemResponseDto.fromDomain(item),
    );
    dto.indicaciones = prescription.indicaciones;
    dto.issuedBy = prescription.issuedBy;
    dto.issuedByName = prescription.issuedByName;
    dto.issuedAt = prescription.issuedAt.toISOString();
    dto.createdAt = prescription.createdAt.toISOString();
    return dto;
  }
}

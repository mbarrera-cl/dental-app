import { ApiProperty } from '@nestjs/swagger';
import type { Quote } from '../../../domain/quote.entity.js';
import type { QuoteItem as QuoteItemEntity, QuoteItemStatus } from '../../../domain/quote-item.entity.js';
import type { QuoteStatus } from '../../../domain/quote.entity.js';

/** Outbound DTO of one quote line. */
export class QuoteItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: '010001', required: false })
  ucoCode: string | null;

  @ApiProperty({ example: 'Obturación de una superficie' })
  description: string;

  @ApiProperty({ example: '16', required: false })
  piezaDental: string | null;

  @ApiProperty({ example: 1 })
  quantity: number;

  @ApiProperty({ example: 4500 })
  unitPrice: number;

  @ApiProperty({ example: 10 })
  discountPercent: number;

  @ApiProperty({ example: 4500 })
  subtotal: number;

  @ApiProperty({ example: 450 })
  discountAmount: number;

  @ApiProperty({ example: 4050 })
  netAmount: number;

  @ApiProperty({ enum: ['generado', 'aprobado', 'rechazado'] })
  status: QuoteItemStatus;

  @ApiProperty({ required: false })
  statusChangedByName: string | null;

  @ApiProperty({ required: false })
  statusChangedAt: string | null;

  static fromDomain(item: QuoteItemEntity): QuoteItemResponseDto {
    const dto = new QuoteItemResponseDto();
    dto.id = item.id;
    dto.ucoCode = item.ucoCode;
    dto.description = item.description;
    dto.piezaDental = item.piezaDental;
    dto.quantity = item.quantity;
    dto.unitPrice = item.unitPrice;
    dto.discountPercent = item.discountPercent;
    dto.subtotal = item.subtotal;
    dto.discountAmount = item.discountAmount;
    dto.netAmount = item.netAmount;
    dto.status = item.status;
    dto.statusChangedByName = item.statusChangedByName;
    dto.statusChangedAt = item.statusChangedAt === null ? null : item.statusChangedAt.toISOString();
    return dto;
  }
}

/** Outbound DTO of a quotation. */
export class QuoteResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'COT-2026-0001' })
  folio: string;

  @ApiProperty()
  patientId: string;

  @ApiProperty({ example: 'Camila Rojas Pérez' })
  patientName: string;

  @ApiProperty({ example: '12345678-5' })
  patientRut: string;

  @ApiProperty({ required: false })
  patientEmail: string | null;

  @ApiProperty({ enum: ['borrador', 'entregada', 'aprobada', 'rechazada'] })
  status: QuoteStatus;

  @ApiProperty({ required: false })
  validUntil: string | null;

  @ApiProperty({ required: false })
  notes: string | null;

  @ApiProperty()
  subtotal: number;

  @ApiProperty()
  discountTotal: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  approvedTotal: number;

  @ApiProperty()
  version: number;

  @ApiProperty({ required: false })
  replacesQuoteId: string | null;

  @ApiProperty()
  createdByName: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedByName: string;

  @ApiProperty()
  updatedAt: string;

  @ApiProperty({ required: false })
  sanctionedByName: string | null;

  @ApiProperty({ required: false })
  sanctionedAt: string | null;

  @ApiProperty({ type: [QuoteItemResponseDto] })
  items: QuoteItemResponseDto[];

  static fromDomain(quote: Quote): QuoteResponseDto {
    const dto = new QuoteResponseDto();
    dto.id = quote.id;
    dto.folio = quote.folio;
    dto.patientId = quote.patientId;
    dto.patientName = quote.patientName;
    dto.patientRut = quote.patientRut;
    dto.patientEmail = quote.patientEmail;
    dto.status = quote.status;
    dto.validUntil = quote.validUntil === null ? null : quote.validUntil.toISOString();
    dto.notes = quote.notes;
    dto.subtotal = quote.subtotal;
    dto.discountTotal = quote.discountTotal;
    dto.total = quote.total;
    dto.approvedTotal = quote.approvedTotal;
    dto.version = quote.version;
    dto.replacesQuoteId = quote.replacesQuoteId;
    dto.createdByName = quote.createdByName;
    dto.createdAt = quote.createdAt.toISOString();
    dto.updatedByName = quote.updatedByName;
    dto.updatedAt = quote.updatedAt.toISOString();
    dto.sanctionedByName = quote.sanctionedByName;
    dto.sanctionedAt = quote.sanctionedAt === null ? null : quote.sanctionedAt.toISOString();
    dto.items = quote.items.map((item) => QuoteItemResponseDto.fromDomain(item));
    return dto;
  }
}

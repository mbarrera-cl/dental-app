import { ApiProperty } from '@nestjs/swagger';
import type {
  QuoteImportPreview,
  QuoteImportPreviewItem,
} from '../../../application/use-cases/preview-quote-import.use-case.js';

export class QuoteImportPreviewItemDto {
  @ApiProperty()
  quoteItemId: string;

  @ApiProperty({ type: String, nullable: true })
  ucoCode: string | null;

  @ApiProperty()
  description: string;

  @ApiProperty({ type: Number, nullable: true })
  tooth: number | null;

  @ApiProperty({ enum: ['nuevo', 'duplicado', 'ambiguo', 'sin-codigo'] })
  flag: string;

  static fromDomain(item: QuoteImportPreviewItem): QuoteImportPreviewItemDto {
    const dto = new QuoteImportPreviewItemDto();

    dto.quoteItemId = item.quoteItemId;
    dto.ucoCode = item.ucoCode;
    dto.description = item.description;
    dto.tooth = item.tooth;
    dto.flag = item.flag;

    return dto;
  }
}

export class QuoteImportPreviewResponseDto {
  @ApiProperty()
  quoteId: string;

  @ApiProperty()
  folio: string;

  @ApiProperty({ type: [QuoteImportPreviewItemDto] })
  items: QuoteImportPreviewItemDto[];

  static fromDomain(
    preview: QuoteImportPreview,
  ): QuoteImportPreviewResponseDto {
    const dto = new QuoteImportPreviewResponseDto();

    dto.quoteId = preview.quoteId;
    dto.folio = preview.folio;
    dto.items = preview.items.map((item) =>
      QuoteImportPreviewItemDto.fromDomain(item),
    );

    return dto;
  }
}

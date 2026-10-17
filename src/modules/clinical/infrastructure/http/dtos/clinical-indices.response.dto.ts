import { ApiProperty } from '@nestjs/swagger';
import type {
  ClinicalIndices,
  IndexBreakdown,
} from '../../../domain/clinical-indices.js';
import type { HigieneOralTotales } from '../../../domain/higiene-oral.vo.js';

export class IndexBreakdownResponseDto {
  @ApiProperty({
    type: [Number],
    example: [16, 26],
    description: 'Teeth counted as C (caries), one per tooth.',
  })
  cariados: number[];

  @ApiProperty({ type: [Number], example: [36], description: 'Teeth counted as P.' })
  perdidos: number[];

  @ApiProperty({ type: [Number], example: [46], description: 'Teeth counted as O.' })
  obturados: number[];

  @ApiProperty({ example: 4, description: 'C + P + O.' })
  total: number;

  static fromDomain(breakdown: IndexBreakdown): IndexBreakdownResponseDto {
    const dto = new IndexBreakdownResponseDto();

    dto.cariados = [...breakdown.cariados];
    dto.perdidos = [...breakdown.perdidos];
    dto.obturados = [...breakdown.obturados];
    dto.total = breakdown.total;

    return dto;
  }
}

export class HigieneOralTotalesResponseDto {
  @ApiProperty({ example: 12 })
  placa: number;

  @ApiProperty({ example: 4 })
  calculo: number;

  @ApiProperty({ example: 3 })
  gingivitis: number;

  @ApiProperty({ example: 19 })
  total: number;

  static fromDomain(totales: HigieneOralTotales): HigieneOralTotalesResponseDto {
    const dto = new HigieneOralTotalesResponseDto();

    dto.placa = totales.placa;
    dto.calculo = totales.calculo;
    dto.gingivitis = totales.gingivitis;
    dto.total = totales.total;

    return dto;
  }
}

/**
 * CPO (permanent) + ceo (primary) indices and hygiene totals, always derived
 * server-side from the odontogram log — the UI never computes them.
 */
export class ClinicalIndicesResponseDto {
  @ApiProperty({ type: IndexBreakdownResponseDto })
  permanentes: IndexBreakdownResponseDto;

  @ApiProperty({ type: IndexBreakdownResponseDto })
  temporales: IndexBreakdownResponseDto;

  @ApiProperty({ type: HigieneOralTotalesResponseDto })
  higieneOral: HigieneOralTotalesResponseDto;

  static fromDomain(indices: ClinicalIndices): ClinicalIndicesResponseDto {
    const dto = new ClinicalIndicesResponseDto();

    dto.permanentes = IndexBreakdownResponseDto.fromDomain(indices.permanentes);
    dto.temporales = IndexBreakdownResponseDto.fromDomain(indices.temporales);
    dto.higieneOral = HigieneOralTotalesResponseDto.fromDomain(indices.higieneOral);

    return dto;
  }
}

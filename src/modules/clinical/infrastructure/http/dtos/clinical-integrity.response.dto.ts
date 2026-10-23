import { ApiProperty } from '@nestjs/swagger';
import { CLINICAL_RECORD_STATUSES } from '../../../domain/ficha-clinica.entity.js';
import type { ClinicalIntegrityResult } from '../../../application/use-cases/verify-clinical-record-integrity.use-case.js';

/**
 * Outbound DTO for the integrity verification of a ficha. `valid` is null
 * while the record is still a draft (there is no seal to verify yet).
 */
export class ClinicalIntegrityResponseDto {
  @ApiProperty({ enum: CLINICAL_RECORD_STATUSES })
  status: 'borrador' | 'finalizada';

  @ApiProperty()
  finalized: boolean;

  @ApiProperty({ type: Boolean, nullable: true })
  valid: boolean | null;

  @ApiProperty({ type: String, nullable: true })
  storedHash: string | null;

  @ApiProperty()
  computedHash: string;

  static fromDomain(result: ClinicalIntegrityResult): ClinicalIntegrityResponseDto {
    const dto = new ClinicalIntegrityResponseDto();

    dto.status = result.status;
    dto.finalized = result.finalized;
    dto.valid = result.valid;
    dto.storedHash = result.storedHash;
    dto.computedHash = result.computedHash;

    return dto;
  }
}

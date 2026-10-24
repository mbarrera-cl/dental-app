import { ApiProperty } from '@nestjs/swagger';
import type { UiSettings } from '../../../application/use-cases/get-ui-settings.use-case.js';

/** `GET /settings/ui` — interface defaults available to every user. */
export class UiSettingsResponseDto {
  @ApiProperty({ example: 10, description: 'Rows per page shown by paginated lists' })
  defaultPageSize: number;

  static fromDomain(settings: UiSettings): UiSettingsResponseDto {
    const dto = new UiSettingsResponseDto();
    dto.defaultPageSize = settings.defaultPageSize;
    return dto;
  }
}

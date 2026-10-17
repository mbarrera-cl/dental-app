import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  MENU_EXTERNAL_URL_MAX_LENGTH,
  MENU_ICON_MAX_LENGTH,
  MENU_LABEL_MAX_LENGTH,
  MENU_ROUTE_KEY_MAX_LENGTH,
} from '../../../domain/menu-item.entity.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Inbound DTO for `PATCH /navigation/items/:id`: every field is tri-state.
 * Absent = leave untouched, `null` (or a blank string for label/icon) =
 * clear it. `kind` and the parent are deliberately not editable here —
 * the type is fixed at creation and moving belongs to the reorder endpoint.
 */
export class UpdateMenuItemRequestDto {
  @ApiPropertyOptional({ nullable: true, maxLength: MENU_LABEL_MAX_LENGTH })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(MENU_LABEL_MAX_LENGTH)
  label?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: MENU_ICON_MAX_LENGTH })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(MENU_ICON_MAX_LENGTH)
  icon?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: MENU_ROUTE_KEY_MAX_LENGTH,
    description: 'Sending routeKey and/or externalUrl replaces the whole destination pair.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(MENU_ROUTE_KEY_MAX_LENGTH)
  routeKey?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: MENU_EXTERNAL_URL_MAX_LENGTH })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(MENU_EXTERNAL_URL_MAX_LENGTH)
  externalUrl?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'settings:read' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  requiredPermission?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

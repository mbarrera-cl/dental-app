import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  MENU_EXTERNAL_URL_MAX_LENGTH,
  MENU_ICON_MAX_LENGTH,
  MENU_KINDS,
  MENU_LABEL_MAX_LENGTH,
  MENU_ROUTE_KEY_MAX_LENGTH,
  type MenuKind,
} from '../../../domain/menu-item.entity.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Inbound DTO for `POST /navigation/items`. The domain layer performs the
 * real validation (kind/destination coherence, https-only URLs, permission
 * catalog, parent rules); these decorators only keep the transport sane.
 */
export class CreateMenuItemRequestDto {
  @ApiProperty({ enum: MENU_KINDS, example: 'item' })
  @IsIn(MENU_KINDS)
  kind: MenuKind;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: MENU_LABEL_MAX_LENGTH,
    description: 'Literal label; omit or send null to use the route registry i18n label.',
  })
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
    description: 'Route registry key (exactly one of routeKey / externalUrl for items).',
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

  @ApiPropertyOptional({ nullable: true, description: 'Parent group id.' })
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'settings:read' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  requiredPermission?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

/** One entry of a drag & drop batch: where the item ends up. */
export class ReorderMenuItemDto {
  @ApiProperty({ example: 'e0a7f6a4-2c2e-4d63-9c62-8d1f8f8f8f8f' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiPropertyOptional({ nullable: true, description: 'Target parent group; null = top level.' })
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @ApiProperty({ example: 2, minimum: 0 })
  @IsInt()
  @Min(0)
  position: number;
}

/** Inbound DTO for `PUT /navigation/order`. */
export class ReorderMenuItemsRequestDto {
  @ApiProperty({ type: [ReorderMenuItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ReorderMenuItemDto)
  items: ReorderMenuItemDto[];
}

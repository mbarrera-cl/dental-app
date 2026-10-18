import { ApiProperty } from '@nestjs/swagger';
import type { ConsentTemplate } from '../../../domain/consent-template.entity.js';

export class ConsentTemplateResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'extraccion' })
  key: string;

  @ApiProperty({ example: 'Consentimiento informado: extracción dental' })
  title: string;

  @ApiProperty()
  body: string;

  @ApiProperty({ example: 1 })
  version: number;

  @ApiProperty()
  active: boolean;

  @ApiProperty({ example: '2026-10-17T12:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-10-17T12:00:00.000Z' })
  updatedAt: string;

  static fromDomain(template: ConsentTemplate): ConsentTemplateResponseDto {
    const dto = new ConsentTemplateResponseDto();
    dto.id = template.id;
    dto.key = template.key;
    dto.title = template.title;
    dto.body = template.body;
    dto.version = template.version;
    dto.active = template.active;
    dto.createdAt = template.createdAt.toISOString();
    dto.updatedAt = template.updatedAt.toISOString();
    return dto;
  }
}

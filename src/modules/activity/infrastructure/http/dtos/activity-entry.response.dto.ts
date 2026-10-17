import { ApiProperty } from '@nestjs/swagger';
import type {
  ActivityActorType,
  ActivityEntry,
  ActivityOutcome,
  ActivityPage,
} from '../../../domain/activity-entry.js';
import type { ActivityPanelConfig } from '../../../application/use-cases/get-activity-config.use-case.js';

export class ActivityActorResponseDto {
  @ApiProperty({ example: '7c1f0a54-…', nullable: true })
  id: string | null;

  @ApiProperty({ enum: ['user', 'apikey', 'system', 'anonymous'], example: 'user' })
  type: ActivityActorType;

  @ApiProperty({ example: 'Ana Pérez', nullable: true })
  name: string | null;

  @ApiProperty({ example: 'ana@clinica.cl', nullable: true })
  email: string | null;

  static fromDomain(entry: ActivityEntry): ActivityActorResponseDto {
    const dto = new ActivityActorResponseDto();
    dto.id = entry.actor.id;
    dto.type = entry.actor.type;
    dto.name = entry.actor.name;
    dto.email = entry.actor.email;
    return dto;
  }
}

export class ActivitySubjectResponseDto {
  @ApiProperty({ example: 'patient', nullable: true })
  type: string | null;

  @ApiProperty({ example: '…', nullable: true })
  id: string | null;

  @ApiProperty({ example: 'Camila Rojas', nullable: true })
  label: string | null;

  static fromDomain(entry: ActivityEntry): ActivitySubjectResponseDto {
    const dto = new ActivitySubjectResponseDto();
    dto.type = entry.subject.type;
    dto.id = entry.subject.id;
    dto.label = entry.subject.label;
    return dto;
  }
}

export class ActivityEntryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: '2026-10-17T12:34:56.789Z' })
  at: string;

  @ApiProperty({ type: ActivityActorResponseDto })
  actor: ActivityActorResponseDto;

  @ApiProperty({ example: 'patients.create' })
  action: string;

  @ApiProperty({ example: 'patients' })
  module: string;

  @ApiProperty({ type: ActivitySubjectResponseDto })
  subject: ActivitySubjectResponseDto;

  @ApiProperty({ enum: ['success', 'failure'] })
  outcome: ActivityOutcome;

  @ApiProperty({ example: 201, nullable: true })
  statusCode: number | null;

  @ApiProperty({ example: 'POST' })
  method: string;

  @ApiProperty({ example: '/patients' })
  path: string;

  @ApiProperty({ example: '/patients', nullable: true })
  route: string | null;

  @ApiProperty({ example: '127.0.0.1', nullable: true })
  ip: string | null;

  @ApiProperty({ nullable: true })
  userAgent: string | null;

  @ApiProperty({ example: {} })
  metadata: Record<string, unknown>;

  static fromDomain(entry: ActivityEntry): ActivityEntryResponseDto {
    const dto = new ActivityEntryResponseDto();
    dto.id = entry.id;
    dto.at = entry.at;
    dto.actor = ActivityActorResponseDto.fromDomain(entry);
    dto.action = entry.action;
    dto.module = entry.module;
    dto.subject = ActivitySubjectResponseDto.fromDomain(entry);
    dto.outcome = entry.outcome;
    dto.statusCode = entry.statusCode;
    dto.method = entry.method;
    dto.path = entry.path;
    dto.route = entry.route;
    dto.ip = entry.ip;
    dto.userAgent = entry.userAgent;
    dto.metadata = entry.metadata;
    return dto;
  }
}

export class ActivityPanelConfigResponseDto {
  @ApiProperty({ example: true })
  enabled: boolean;

  @ApiProperty({ example: 20 })
  panelLimit: number;

  @ApiProperty({ example: 60 })
  refreshSeconds: number;

  @ApiProperty({ example: true })
  badge: boolean;

  static fromDomain(config: ActivityPanelConfig): ActivityPanelConfigResponseDto {
    const dto = new ActivityPanelConfigResponseDto();
    dto.enabled = config.enabled;
    dto.panelLimit = config.panelLimit;
    dto.refreshSeconds = config.refreshSeconds;
    dto.badge = config.badge;
    return dto;
  }
}

export class ActivityPageResponseDto {
  @ApiProperty({ type: ActivityPanelConfigResponseDto })
  config: ActivityPanelConfigResponseDto;

  @ApiProperty({ type: [ActivityEntryResponseDto] })
  items: ActivityEntryResponseDto[];

  @ApiProperty({ example: 'eyJhdCI6…', nullable: true })
  nextCursor: string | null;

  static fromDomain(page: ActivityPage, config: ActivityPanelConfig): ActivityPageResponseDto {
    const dto = new ActivityPageResponseDto();
    dto.config = ActivityPanelConfigResponseDto.fromDomain(config);
    dto.items = page.items.map((item) => ActivityEntryResponseDto.fromDomain(item));
    dto.nextCursor = page.nextCursor;
    return dto;
  }
}

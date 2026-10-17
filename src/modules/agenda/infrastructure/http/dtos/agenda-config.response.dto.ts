import { ApiProperty } from '@nestjs/swagger';

export class AgendaConfigResponseDto {
  @ApiProperty({ example: 'America/Santiago' })
  timeZone!: string;

  @ApiProperty({ example: 30 })
  defaultDurationMinutes!: number;

  @ApiProperty()
  notifyPatient!: boolean;

  @ApiProperty()
  notifyProfessional!: boolean;
}

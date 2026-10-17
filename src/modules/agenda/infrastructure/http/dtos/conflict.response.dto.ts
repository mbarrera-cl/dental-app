import { ApiProperty } from '@nestjs/swagger';

export class ConflictResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  startsAt!: string;

  @ApiProperty()
  endsAt!: string;

  @ApiProperty()
  patientName!: string;

  @ApiProperty()
  professionalName!: string;
}

import { Injectable } from '@nestjs/common';
import { SettingsService } from '../../../settings/application/settings.service.js';

export interface AgendaConfig {
  timeZone: string;
  defaultDurationMinutes: number;
  notifyPatient: boolean;
  notifyProfessional: boolean;
}

@Injectable()
export class GetAgendaConfigUseCase {
  constructor(private readonly settings: SettingsService) {}

  async execute(): Promise<AgendaConfig> {
    const [timeZone, defaultDurationMinutes, notifyPatient, notifyProfessional] = await Promise.all([
      this.settings.getValue('clinic.timeZone'),
      this.settings.getNumber('agenda.defaultDurationMinutes'),
      this.settings.getBoolean('agenda.notifyPatient'),
      this.settings.getBoolean('agenda.notifyProfessional'),
    ]);

    return {
      timeZone: String(timeZone),
      defaultDurationMinutes,
      notifyPatient,
      notifyProfessional,
    };
  }
}

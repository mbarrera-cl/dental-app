import { Injectable } from '@nestjs/common';
import { AgendaReasonRepositoryPort } from '../ports/agenda-reason-repository.port.js';
import { AgendaReason } from '../../domain/agenda-reason.entity.js';

export interface CreateAgendaReasonCommand {
  name: string;
  actorId: string;
}

@Injectable()
export class CreateAgendaReasonUseCase {
  constructor(private readonly reasons: AgendaReasonRepositoryPort) {}

  async execute(command: CreateAgendaReasonCommand): Promise<AgendaReason> {
    const reason = AgendaReason.create({ name: command.name, createdBy: command.actorId });
    await this.reasons.save(reason);
    return reason;
  }
}

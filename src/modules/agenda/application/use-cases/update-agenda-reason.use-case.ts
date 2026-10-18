import { Injectable } from '@nestjs/common';
import { AgendaReasonRepositoryPort } from '../ports/agenda-reason-repository.port.js';
import { AgendaReasonNotFoundError } from '../../domain/appointment.errors.js';
import type { AgendaReason } from '../../domain/agenda-reason.entity.js';

export interface UpdateAgendaReasonCommand {
  id: string;
  name: string;
  actorId: string;
}

@Injectable()
export class UpdateAgendaReasonUseCase {
  constructor(private readonly reasons: AgendaReasonRepositoryPort) {}

  async execute(command: UpdateAgendaReasonCommand): Promise<AgendaReason> {
    const reason = await this.reasons.findById(command.id);

    if (reason === null) {
      throw new AgendaReasonNotFoundError(command.id);
    }

    reason.rename(command.name, command.actorId);
    await this.reasons.update(reason);
    return reason;
  }
}

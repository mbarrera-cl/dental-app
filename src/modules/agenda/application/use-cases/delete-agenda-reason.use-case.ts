import { Injectable } from '@nestjs/common';
import { AgendaReasonRepositoryPort } from '../ports/agenda-reason-repository.port.js';

@Injectable()
export class DeleteAgendaReasonUseCase {
  constructor(private readonly reasons: AgendaReasonRepositoryPort) {}

  async execute(id: string): Promise<void> {
    await this.reasons.delete(id);
  }
}

import { Injectable } from '@nestjs/common';
import { AgendaReasonRepositoryPort } from '../ports/agenda-reason-repository.port.js';
import type { AgendaReason } from '../../domain/agenda-reason.entity.js';

@Injectable()
export class ListAgendaReasonsUseCase {
  constructor(private readonly reasons: AgendaReasonRepositoryPort) {}

  execute(): Promise<AgendaReason[]> {
    return this.reasons.findAll();
  }
}

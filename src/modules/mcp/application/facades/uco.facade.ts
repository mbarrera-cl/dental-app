import { Injectable } from '@nestjs/common';
import { ListUcoProceduresUseCase } from '../../../uco/application/use-cases/list-uco-procedures.use-case.js';
import { UcoProcedureRepositoryPort } from '../../../uco/application/ports/uco-procedure-repository.port.js';
import type { UcoProcedure } from '../../../uco/domain/uco-procedure.entity.js';

export interface UcoProcedureView {
  id: string;
  code: string;
  chapter: string;
  name: string;
  units: number;
  status: 'active' | 'inactive';
}

/** MCP-facing reads of the UCO fee catalog (Arancel UCO). */
@Injectable()
export class UcoFacade {
  constructor(
    private readonly list: ListUcoProceduresUseCase,
    private readonly procedures: UcoProcedureRepositoryPort,
  ) {}

  async search(query: string, limit: number): Promise<UcoProcedureView[]> {
    const procedures = await this.list.execute({ q: query, active: true });

    return procedures.slice(0, limit).map(toView);
  }

  async getByCode(code: string): Promise<UcoProcedureView> {
    const procedure = await this.procedures.findByCode(code.trim());

    if (procedure === null) {
      throw new Error(`UCO procedure not found: ${code}`);
    }

    return toView(procedure);
  }
}

export function toView(procedure: UcoProcedure): UcoProcedureView {
  return {
    id: procedure.id,
    code: procedure.code,
    chapter: procedure.chapter,
    name: procedure.name,
    units: procedure.units,
    status: procedure.status,
  };
}

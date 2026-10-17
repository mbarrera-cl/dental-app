import { describe, expect, it } from 'vitest';
import { UcoProcedure } from '../../domain/uco-procedure.entity.js';
import { InMemoryUcoProcedureRepository } from '../../infrastructure/adapters/persistence/in-memory-uco-procedure.repository.js';
import { UpdateUcoProcedureUseCase } from './update-uco-procedure.use-case.js';

describe('UpdateUcoProcedureUseCase', () => {
  it('updates fields and reports whether the code changed', async () => {
    const procedures = new InMemoryUcoProcedureRepository();
    const procedure = UcoProcedure.create({
      code: '010001',
      chapter: '1',
      name: 'Consulta',
      units: 1,
    });

    await procedures.save(procedure);
    const useCase = new UpdateUcoProcedureUseCase(procedures);

    const changedName = await useCase.execute({
      id: procedure.id,
      name: 'Consulta integral',
      actorId: 'user-1',
    });

    expect(changedName.procedure.name).toBe('Consulta integral');
    expect(changedName.codeChanged).toBe(false);

    const changedCode = await useCase.execute({
      id: procedure.id,
      code: '010002',
      actorId: 'user-1',
    });

    expect(changedCode.procedure.code).toBe('010002');
    expect(changedCode.codeChanged).toBe(true);
  });

  it('soft-deletes with active=false and reactivates with active=true', async () => {
    const procedures = new InMemoryUcoProcedureRepository();
    const procedure = UcoProcedure.create({ code: 'X1', chapter: '1', name: 'X', units: 1 });

    await procedures.save(procedure);
    const useCase = new UpdateUcoProcedureUseCase(procedures);

    const inactive = await useCase.execute({ id: procedure.id, active: false, actorId: null });
    expect(inactive.procedure.status).toBe('inactive');

    const active = await useCase.execute({ id: procedure.id, active: true, actorId: null });
    expect(active.procedure.status).toBe('active');
  });
});

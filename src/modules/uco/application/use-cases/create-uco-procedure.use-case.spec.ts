import { describe, expect, it } from 'vitest';
import { UcoProcedureCodeTakenError } from '../../domain/uco.errors.js';
import { InMemoryUcoProcedureRepository } from '../../infrastructure/adapters/persistence/in-memory-uco-procedure.repository.js';
import { CreateUcoProcedureUseCase } from './create-uco-procedure.use-case.js';

describe('CreateUcoProcedureUseCase', () => {
  it('creates an active procedure with a normalized code', async () => {
    const procedures = new InMemoryUcoProcedureRepository();
    const useCase = new CreateUcoProcedureUseCase(procedures);

    const created = await useCase.execute({
      code: ' 010001 ',
      chapter: '1',
      name: 'Consulta dental',
      units: 1.5,
      actorId: 'user-1',
    });

    expect(created.code).toBe('010001');
    expect(created.status).toBe('active');

    const found = await procedures.findByCode('010001');
    expect(found?.name).toBe('Consulta dental');
  });

  it('rejects a duplicate code as a conflict', async () => {
    const procedures = new InMemoryUcoProcedureRepository();
    const useCase = new CreateUcoProcedureUseCase(procedures);

    await useCase.execute({ code: '010001', chapter: '1', name: 'A', units: 1, actorId: null });
    await expect(
      useCase.execute({ code: '010001', chapter: '1', name: 'B', units: 1, actorId: null }),
    ).rejects.toBeInstanceOf(UcoProcedureCodeTakenError);
  });
});

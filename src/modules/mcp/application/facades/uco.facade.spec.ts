import type { UcoProcedureRepositoryPort } from '../../../uco/application/ports/uco-procedure-repository.port.js';
import type { ListUcoProceduresUseCase } from '../../../uco/application/use-cases/list-uco-procedures.use-case.js';
import type { SettingsService } from '../../../settings/application/settings.service.js';
import { UcoProcedure } from '../../../uco/domain/uco-procedure.entity.js';
import { UcoFacade, toView } from './uco.facade.js';

function procedure(code: string, units: number): UcoProcedure {
  const now = new Date();

  return UcoProcedure.reconstitute(
    {
      code,
      chapter: 'EXO',
      name: `Prestación ${code}`,
      units,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    `u-${code}`,
  );
}

function listCase(items: UcoProcedure[]): ListUcoProceduresUseCase {
  return {
    execute: vi.fn(async () => items),
  } as unknown as ListUcoProceduresUseCase;
}

function repository(byCode: UcoProcedure | null): UcoProcedureRepositoryPort {
  return {
    findByCode: vi.fn(async () => byCode),
  } as unknown as UcoProcedureRepositoryPort;
}

function settingsWith(rate: number): SettingsService {
  return {
    getNumber: vi.fn(async (key: string) =>
      key === 'quotes.ucoRate' ? rate : 0,
    ),
  } as unknown as SettingsService;
}

describe('UcoFacade', () => {
  it('search returns procedures with the CLP price computed from the rate', async () => {
    const facade = new UcoFacade(
      listCase([procedure('010001', 1.5), procedure('010002', 2)]),
      repository(null),
      settingsWith(3000),
    );

    const items = await facade.search('', 10);

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual(
      expect.objectContaining({
        code: '010001',
        units: 1.5,
        unitPrice: 4500,
        rate: 3000,
      }),
    );
    expect(items[1]).toEqual(
      expect.objectContaining({ code: '010002', unitPrice: 6000, rate: 3000 }),
    );
  });

  it('search respects the requested limit', async () => {
    const facade = new UcoFacade(
      listCase([
        procedure('010001', 1),
        procedure('010002', 1),
        procedure('010003', 1),
      ]),
      repository(null),
      settingsWith(3000),
    );

    const items = await facade.search('', 2);

    expect(items).toHaveLength(2);
  });

  it('getByCode returns one procedure with its CLP price and the rate', async () => {
    const facade = new UcoFacade(
      listCase([]),
      repository(procedure('010001', 0.75)),
      settingsWith(3265),
    );

    const view = await facade.getByCode('010001');

    expect(view).toEqual(
      expect.objectContaining({
        code: '010001',
        units: 0.75,
        unitPrice: 2449,
        rate: 3265,
      }),
    );
  });

  it('getByCode rethrows the not-found error', async () => {
    const facade = new UcoFacade(
      listCase([]),
      repository(null),
      settingsWith(3000),
    );

    await expect(facade.getByCode('999999')).rejects.toThrow(
      'UCO procedure not found: 999999',
    );
  });

  it('toView rounds the price of decimal units', () => {
    const view = toView(procedure('010001', 1.234), 3000.5);

    expect(view.unitPrice).toBe(3703);
  });
});

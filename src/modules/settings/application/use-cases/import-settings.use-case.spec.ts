import type { SettingValue } from '../../domain/setting-definition.js';
import { SettingsAuditRepositoryPort } from '../ports/settings-audit-repository.port.js';
import { SettingsRepositoryPort } from '../ports/settings-repository.port.js';
import { SettingsAuditService } from '../settings-audit.service.js';
import { SettingsService } from '../settings.service.js';
import { ImportSettingsUseCase } from './import-settings.use-case.js';
import { UpdateSettingsUseCase } from './update-settings.use-case.js';

class FakeSettingsRepository extends SettingsRepositoryPort {
  stored: Record<string, SettingValue> = {};

  async findAll(): Promise<Record<string, SettingValue>> {
    return { ...this.stored };
  }

  async saveMany(values: Record<string, SettingValue>): Promise<void> {
    Object.assign(this.stored, values);
  }
}

class FakeAuditRepository extends SettingsAuditRepositoryPort {
  async append(): Promise<void> {}

  async list() {
    return [];
  }
}

describe('ImportSettingsUseCase', () => {
  const setup = () => {
    const repository = new FakeSettingsRepository();
    const updateSettings = new UpdateSettingsUseCase(
      new SettingsService(repository),
      new SettingsAuditService(new FakeAuditRepository()),
    );
    const useCase = new ImportSettingsUseCase(updateSettings);

    return { repository, useCase };
  };

  it('imports a full exported envelope through the update path', async () => {
    const { repository, useCase } = setup();

    const overview = await useCase.execute({
      envelope: {
        app: 'hexa',
        version: 1,
        exportedAt: '2026-10-16T12:00:00.000Z',
        values: { 'clinic.name': 'Clínica Importada', 'clinic.theme.mode': 'auto' },
      },
      actor: { id: 'user-1', type: 'user' },
    });

    expect(repository.stored).toEqual({
      'clinic.name': 'Clínica Importada',
      'clinic.theme.mode': 'auto',
    });
    expect(overview.find((setting) => setting.key === 'clinic.name')?.value).toBe(
      'Clínica Importada',
    );
  });

  it('rejects malformed envelopes before touching storage', async () => {
    const { repository, useCase } = setup();

    await expect(
      useCase.execute({ envelope: { values: 'nope' }, actor: { id: 'user-1', type: 'user' } }),
    ).rejects.toMatchObject({ name: 'SettingsValueInvalidError' });
    expect(repository.stored).toEqual({});
  });

  it('rejects unknown keys all-or-nothing', async () => {
    const { repository, useCase } = setup();

    await expect(
      useCase.execute({
        envelope: { values: { 'clinic.name': 'Ok', 'nope.thing': 1 } },
        actor: { id: 'user-1', type: 'user' },
      }),
    ).rejects.toMatchObject({ name: 'SettingsUnknownKeyError' });
    expect(repository.stored).toEqual({});
  });

  it('rejects managed keys coming from a crafted file', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({
        envelope: { values: { 'clinic.logo.version': 99 } },
        actor: { id: 'user-1', type: 'user' },
      }),
    ).rejects.toMatchObject({ name: 'SettingsValueInvalidError' });
  });
});

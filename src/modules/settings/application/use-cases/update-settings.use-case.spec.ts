import type { SettingValue } from '../../domain/setting-definition.js';
import { SettingsRepositoryPort } from '../ports/settings-repository.port.js';
import { SettingsService } from '../settings.service.js';
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

describe('UpdateSettingsUseCase', () => {
  const setup = () => {
    const repository = new FakeSettingsRepository();
    const useCase = new UpdateSettingsUseCase(new SettingsService(repository));

    return { repository, useCase };
  };

  it('delegates valid updates to the settings service', async () => {
    const { repository, useCase } = setup();

    const overview = await useCase.execute({ values: { 'passwordPolicy.minLength': 10 } });

    expect(repository.stored).toEqual({ 'passwordPolicy.minLength': 10 });
    expect(overview.find((setting) => setting.key === 'passwordPolicy.minLength')?.value).toBe(10);
  });

  it('rejects settings managed by their own module', async () => {
    const { repository, useCase } = setup();

    await expect(useCase.execute({ values: { 'clinic.logo.version': 2 } })).rejects.toMatchObject({
      name: 'SettingsValueInvalidError',
      details: {
        problems: [
          {
            key: 'clinic.logo.version',
            reason: 'is managed internally and cannot be edited',
          },
        ],
      },
    });
    expect(repository.stored).toEqual({});
  });
});

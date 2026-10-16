import type { SettingValue } from '../domain/setting-definition.js';
import { SettingsRepositoryPort } from './ports/settings-repository.port.js';
import { SettingsService } from './settings.service.js';

class FakeSettingsRepository extends SettingsRepositoryPort {
  stored: Record<string, SettingValue> = {};

  async findAll(): Promise<Record<string, SettingValue>> {
    return { ...this.stored };
  }

  async saveMany(values: Record<string, SettingValue>): Promise<void> {
    Object.assign(this.stored, values);
  }
}

describe('SettingsService', () => {
  const setup = () => {
    const repository = new FakeSettingsRepository();
    const service = new SettingsService(repository);

    return { repository, service };
  };

  it('merges stored values over registry defaults', async () => {
    const { repository, service } = setup();
    repository.stored['passwordPolicy.minLength'] = 12;

    const overview = await service.overview();
    const minLength = overview.find((setting) => setting.key === 'passwordPolicy.minLength');

    expect(minLength?.value).toBe(12);
    expect(minLength?.default).toBe(8);
    expect(minLength?.type).toBe('number');
    expect(minLength?.min).toBe(6);
  });

  it('persists valid updates and returns the fresh overview', async () => {
    const { repository, service } = setup();

    const overview = await service.update({
      'passwordPolicy.minLength': 10,
      'login.maxFailedAttempts': 0,
    });

    expect(repository.stored).toEqual({
      'passwordPolicy.minLength': 10,
      'login.maxFailedAttempts': 0,
    });
    expect(overview.find((setting) => setting.key === 'passwordPolicy.minLength')?.value).toBe(10);
  });

  it('invalidates its cache so updates apply immediately', async () => {
    const { service } = setup();

    await expect(service.getNumber('passwordPolicy.minLength')).resolves.toBe(8);

    await service.update({ 'passwordPolicy.minLength': 14 });

    await expect(service.getNumber('passwordPolicy.minLength')).resolves.toBe(14);
  });

  it('rejects empty updates', async () => {
    const { service } = setup();

    await expect(service.update({})).rejects.toMatchObject({ name: 'EmptySettingsUpdateError' });
  });

  it('rejects unknown keys in one detailed error', async () => {
    const { repository, service } = setup();

    await expect(service.update({ 'nope.thing': 1, 'also.bad': true })).rejects.toMatchObject({
      name: 'SettingsUnknownKeyError',
      details: { keys: ['nope.thing', 'also.bad'] },
    });
    expect(repository.stored).toEqual({});
  });

  it('rejects invalid values listing every problem', async () => {
    const { service } = setup();

    await expect(
      service.update({ 'passwordPolicy.minLength': 2, 'login.maxFailedAttempts': true }),
    ).rejects.toMatchObject({
      name: 'SettingsValueInvalidError',
      details: {
        problems: [
          { key: 'passwordPolicy.minLength', reason: 'must be >= 6' },
          { key: 'login.maxFailedAttempts', reason: 'must be an integer' },
        ],
      },
    });
  });

  it('enforces cross-field consistency between min and max length', async () => {
    const { service } = setup();

    await expect(
      service.update({ 'passwordPolicy.minLength': 64, 'passwordPolicy.maxLength': 8 }),
    ).rejects.toMatchObject({
      name: 'SettingsValueInvalidError',
      details: {
        problems: [
          { key: 'passwordPolicy.minLength', reason: 'must be <= passwordPolicy.maxLength (8)' },
        ],
      },
    });
  });

  it('exposes typed getters and fails loudly on type mismatches', async () => {
    const { service } = setup();

    await expect(service.getBoolean('passwordPolicy.requireUppercase')).resolves.toBe(true);
    await expect(service.getNumber('nope.thing')).rejects.toMatchObject({
      name: 'SettingsUnknownKeyError',
    });
    await expect(service.getBoolean('passwordPolicy.minLength')).rejects.toThrow(
      'Setting "passwordPolicy.minLength" is not a boolean',
    );
  });
});

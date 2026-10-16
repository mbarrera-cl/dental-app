import { SettingsRepositoryPort } from '../../modules/settings/application/ports/settings-repository.port.js';
import { SettingsService } from '../../modules/settings/application/settings.service.js';
import type { SettingValue } from '../../modules/settings/domain/setting-definition.js';
import { PasswordPolicyService } from './password-policy.js';

class FakeSettingsRepository extends SettingsRepositoryPort {
  stored: Record<string, SettingValue> = {};

  async findAll(): Promise<Record<string, SettingValue>> {
    return { ...this.stored };
  }

  async saveMany(values: Record<string, SettingValue>): Promise<void> {
    Object.assign(this.stored, values);
  }
}

describe('PasswordPolicyService', () => {
  let repository: FakeSettingsRepository;
  let policy: PasswordPolicyService;

  beforeEach(() => {
    repository = new FakeSettingsRepository();
    policy = new PasswordPolicyService(new SettingsService(repository));
  });

  it('accepts a candidate satisfying the defaults', async () => {
    await expect(policy.validate('Str0ng-Passw0rd!')).resolves.toEqual([]);
  });

  it('reports every broken rule at once', async () => {
    const violations = await policy.validate('abc');

    expect(violations.map((violation) => violation.rule)).toEqual([
      'minLength',
      'uppercase',
      'digit',
      'symbol',
    ]);
  });

  it('honours configurable values', async () => {
    repository.stored = {
      'passwordPolicy.minLength': 3,
      'passwordPolicy.requireUppercase': false,
      'passwordPolicy.requireLowercase': false,
      'passwordPolicy.requireDigit': false,
      'passwordPolicy.requireSymbol': false,
    };

    await expect(policy.validate('abc')).resolves.toEqual([]);
  });

  it('rejects candidates longer than the configured maximum', async () => {
    repository.stored = { 'passwordPolicy.maxLength': 10 };

    const violations = await policy.validate('Str0ng-Passw0rd!');

    expect(violations).toEqual([{ rule: 'maxLength', message: 'must be at most 10 characters long' }]);
  });
});

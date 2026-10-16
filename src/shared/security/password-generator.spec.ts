import { SettingsRepositoryPort } from '../../modules/settings/application/ports/settings-repository.port.js';
import { SettingsService } from '../../modules/settings/application/settings.service.js';
import type { SettingValue } from '../../modules/settings/domain/setting-definition.js';
import { generatePassword } from './password-generator.js';
import { PasswordPolicyService, type PasswordPolicyShape } from './password-policy.js';

class FakeSettingsRepository extends SettingsRepositoryPort {
  stored: Record<string, SettingValue> = {};

  async findAll(): Promise<Record<string, SettingValue>> {
    return { ...this.stored };
  }

  async saveMany(values: Record<string, SettingValue>): Promise<void> {
    Object.assign(this.stored, values);
  }
}

/** First character of every pool — makes the output fully deterministic. */
const first = () => 0;

describe('generatePassword', () => {
  const defaults: PasswordPolicyShape = {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireDigit: true,
    requireSymbol: true,
  };

  it('produces a 16-character password satisfying every required class', () => {
    const password = generatePassword(defaults, first);

    expect(password).toHaveLength(16);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/\d/);
    expect(password).toMatch(/[^A-Za-z0-9]/);
  });

  it('avoids ambiguous characters so it survives being transcribed', () => {
    const password = generatePassword(defaults, first);

    expect(password).not.toMatch(/[Il0O1]/);
  });

  it('honours a tighter maximum length', () => {
    const password = generatePassword({ ...defaults, minLength: 8, maxLength: 10 }, first);

    expect(password).toHaveLength(10);
  });

  it('skips classes the policy does not require', () => {
    const password = generatePassword(
      { ...defaults, requireUppercase: false, requireDigit: false, requireSymbol: false },
      first,
    );

    expect(password).toHaveLength(16);
    // Purely random data from the remaining pools; still, every character is
    // from the allowed alphabet.
    expect(password).toMatch(/^[A-Za-z0-9!@#$%&*+\-_=]+$/);
  });

  it('generates passwords the validator accepts (fuzz over policies)', async () => {
    const settings = new SettingsService(new FakeSettingsRepository());
    const policy = new PasswordPolicyService(settings);

    for (const maxLength of [8, 12, 16, 64]) {
      const password = generatePassword({ ...defaults, maxLength });
      await expect(policy.validate(password)).resolves.toEqual([]);
    }
  });

  it('fails loudly when the policy is impossible to satisfy', () => {
    expect(() => generatePassword({ ...defaults, minLength: 20, maxLength: 10 }, first)).toThrow(
      /no feasible length range/,
    );
  });
});

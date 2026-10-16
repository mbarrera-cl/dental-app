import { Injectable } from '@nestjs/common';
import { SettingsService } from '../../modules/settings/application/settings.service.js';

/** One broken rule, shaped for the UI (map `rule` to an i18n message). */
export interface PasswordPolicyViolation {
  rule: 'minLength' | 'maxLength' | 'uppercase' | 'lowercase' | 'digit' | 'symbol';
  message: string;
}

/**
 * Validates a password candidate against the *configurable* policy stored in
 * settings. Returns every violation at once (better UX than failing on the
 * first one); callers decide which error to raise.
 */
@Injectable()
export class PasswordPolicyService {
  constructor(private readonly settings: SettingsService) {}

  async validate(candidate: string): Promise<PasswordPolicyViolation[]> {
    const values = new Map((await this.settings.overview()).map((setting) => [setting.key, setting.value]));
    const violations: PasswordPolicyViolation[] = [];

    const minLength = values.get('passwordPolicy.minLength') as number;
    const maxLength = values.get('passwordPolicy.maxLength') as number;

    if (candidate.length < minLength) {
      violations.push({
        rule: 'minLength',
        message: `must be at least ${minLength} characters long`,
      });
    }

    if (candidate.length > maxLength) {
      violations.push({
        rule: 'maxLength',
        message: `must be at most ${maxLength} characters long`,
      });
    }

    if (values.get('passwordPolicy.requireUppercase') === true && !/[A-Z]/.test(candidate)) {
      violations.push({ rule: 'uppercase', message: 'must contain an uppercase letter' });
    }

    if (values.get('passwordPolicy.requireLowercase') === true && !/[a-z]/.test(candidate)) {
      violations.push({ rule: 'lowercase', message: 'must contain a lowercase letter' });
    }

    if (values.get('passwordPolicy.requireDigit') === true && !/\d/.test(candidate)) {
      violations.push({ rule: 'digit', message: 'must contain a digit' });
    }

    if (values.get('passwordPolicy.requireSymbol') === true && !/[^A-Za-z0-9]/.test(candidate)) {
      violations.push({ rule: 'symbol', message: 'must contain a symbol' });
    }

    return violations;
  }
}

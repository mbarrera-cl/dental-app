import { Injectable } from '@nestjs/common';
import { SettingsService } from '../../modules/settings/application/settings.service.js';

/** One broken rule, shaped for the UI (map `rule` to an i18n message). */
export interface PasswordPolicyViolation {
  rule: 'minLength' | 'maxLength' | 'uppercase' | 'lowercase' | 'digit' | 'symbol';
  message: string;
}

/**
 * Effective policy as plain data: consumed by validators, by the random
 * password generator (it must produce a candidate the validator accepts)
 * and by anything else that needs to reason about the rules.
 */
export interface PasswordPolicyShape {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSymbol: boolean;
}

/**
 * Validates a password candidate against the *configurable* policy stored in
 * settings. Returns every violation at once (better UX than failing on the
 * first one); callers decide which error to raise.
 */
@Injectable()
export class PasswordPolicyService {
  constructor(private readonly settings: SettingsService) {}

  /** Current values of every policy rule, read from settings. */
  async describe(): Promise<PasswordPolicyShape> {
    const values = new Map((await this.settings.overview()).map((setting) => [setting.key, setting.value]));

    return {
      minLength: values.get('passwordPolicy.minLength') as number,
      maxLength: values.get('passwordPolicy.maxLength') as number,
      requireUppercase: values.get('passwordPolicy.requireUppercase') === true,
      requireLowercase: values.get('passwordPolicy.requireLowercase') === true,
      requireDigit: values.get('passwordPolicy.requireDigit') === true,
      requireSymbol: values.get('passwordPolicy.requireSymbol') === true,
    };
  }

  async validate(candidate: string): Promise<PasswordPolicyViolation[]> {
    const policy = await this.describe();
    const violations: PasswordPolicyViolation[] = [];

    if (candidate.length < policy.minLength) {
      violations.push({
        rule: 'minLength',
        message: `must be at least ${policy.minLength} characters long`,
      });
    }

    if (candidate.length > policy.maxLength) {
      violations.push({
        rule: 'maxLength',
        message: `must be at most ${policy.maxLength} characters long`,
      });
    }

    if (policy.requireUppercase && !/[A-Z]/.test(candidate)) {
      violations.push({ rule: 'uppercase', message: 'must contain an uppercase letter' });
    }

    if (policy.requireLowercase && !/[a-z]/.test(candidate)) {
      violations.push({ rule: 'lowercase', message: 'must contain a lowercase letter' });
    }

    if (policy.requireDigit && !/\d/.test(candidate)) {
      violations.push({ rule: 'digit', message: 'must contain a digit' });
    }

    if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(candidate)) {
      violations.push({ rule: 'symbol', message: 'must contain a symbol' });
    }

    return violations;
  }
}

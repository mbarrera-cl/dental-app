import { Entity } from '../../../shared/domain/entity.js';
import { Email } from './email.vo.js';
import { InvalidNameError } from './user.errors.js';

export type UserStatus = 'active' | 'disabled';

export interface UserProps {
  email: Email;
  name: string;
  createdAt: Date;
  /** scrypt hash, or null when the account has no password yet (cannot log in). */
  passwordHash: string | null;
  status: UserStatus;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  passwordChangedAt: Date | null;
  /** Set after an admin reset: the user must pick a new password on next login. */
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
}

export interface CreateUserProps {
  email: string;
  name: string;
  passwordHash?: string | null;
  status?: UserStatus;
}

/**
 * User aggregate root. This is the only place where user invariants are
 * enforced. Instances are created through `create` (new user) or
 * `reconstitute` (rebuilt from persistence), so a `User` is always valid.
 */
export class User extends Entity<UserProps> {
  private constructor(props: UserProps, id?: string) {
    super(props, id);
  }

  static create({ email, name, passwordHash = null, status = 'active' }: CreateUserProps): User {
    return new User({
      email: Email.create(email),
      name: User.normalizeName(name),
      createdAt: new Date(),
      passwordHash,
      status,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: passwordHash === null ? null : new Date(),
      mustChangePassword: false,
      lastLoginAt: null,
    });
  }

  /** Rebuilds a user that already exists (e.g. loaded from a database). */
  static reconstitute(props: UserProps, id: string): User {
    return new User(props, id);
  }

  get email(): string {
    return this.props.email.value;
  }

  get name(): string {
    return this.props.name;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get passwordHash(): string | null {
    return this.props.passwordHash;
  }

  /** Users without a stored password cannot log in until one is set. */
  get hasPassword(): boolean {
    return this.props.passwordHash !== null;
  }

  get status(): UserStatus {
    return this.props.status;
  }

  get failedLoginAttempts(): number {
    return this.props.failedLoginAttempts;
  }

  get lockedUntil(): Date | null {
    return this.props.lockedUntil;
  }

  get passwordChangedAt(): Date | null {
    return this.props.passwordChangedAt;
  }

  get mustChangePassword(): boolean {
    return this.props.mustChangePassword;
  }

  get lastLoginAt(): Date | null {
    return this.props.lastLoginAt;
  }

  /** Mutators enforce the same invariants as `create`. */
  changeName(name: string): void {
    this.props.name = User.normalizeName(name);
  }

  changeEmail(email: Email): void {
    this.props.email = email;
  }

  setPassword(passwordHash: string, options: { mustChange: boolean; changedAt?: Date }): void {
    this.props.passwordHash = passwordHash;
    this.props.passwordChangedAt = options.changedAt ?? new Date();
    this.props.mustChangePassword = options.mustChange;
  }

  changeStatus(status: UserStatus): void {
    this.props.status = status;
  }

  registerFailedLogin(): void {
    this.props.failedLoginAttempts += 1;
  }

  lockUntil(until: Date): void {
    this.props.lockedUntil = until;
  }

  clearLoginFailures(): void {
    this.props.failedLoginAttempts = 0;
    this.props.lockedUntil = null;
  }

  recordLoginSuccess(at: Date): void {
    this.props.lastLoginAt = at;
    this.clearLoginFailures();
  }

  isLockedAt(now: Date): boolean {
    return this.props.lockedUntil !== null && this.props.lockedUntil.getTime() > now.getTime();
  }

  /** Expiry is measured from the last password change; `0` days disables it. */
  isPasswordExpiredAt(now: Date, expirationDays: number): boolean {
    if (expirationDays <= 0 || this.props.passwordHash === null) {
      return false;
    }

    if (this.props.passwordChangedAt === null) {
      return true;
    }

    const expiresAt = this.props.passwordChangedAt.getTime() + expirationDays * 24 * 60 * 60 * 1000;

    return expiresAt <= now.getTime();
  }

  /** A password change is required by an admin reset or by policy expiry. */
  requiresPasswordChangeAt(now: Date, expirationDays: number): boolean {
    return this.props.mustChangePassword || this.isPasswordExpiredAt(now, expirationDays);
  }

  private static normalizeName(name: string): string {
    const normalized = name.trim();

    if (normalized.length === 0) {
      throw new InvalidNameError();
    }

    return normalized;
  }
}

import { Email } from './email.vo.js';
import { User, type UserProps } from './user.entity.js';
import { InvalidEmailError, InvalidNameError } from './user.errors.js';

describe('User', () => {
  const validProps = { email: 'ada@example.com', name: 'Ada Lovelace' };

  const persistedProps: UserProps = {
    email: Email.create('ada@example.com'),
    name: 'Ada Lovelace',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    passwordHash: null,
    status: 'active',
    failedLoginAttempts: 0,
    lockedUntil: null,
    passwordChangedAt: null,
    mustChangePassword: false,
    lastLoginAt: null,
  };

  it('normalizes email and name on create', () => {
    const user = User.create({
      email: '  Ada@Example.COM ',
      name: '  Ada Lovelace  ',
    });

    expect(user.email).toBe('ada@example.com');
    expect(user.name).toBe('Ada Lovelace');
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it('generates a unique id per user', () => {
    expect(User.create(validProps).id).not.toBe(User.create(validProps).id);
  });

  it('throws InvalidEmailError for malformed emails', () => {
    expect(() => User.create({ ...validProps, email: 'not-an-email' })).toThrow(InvalidEmailError);
  });

  it('throws InvalidNameError for blank names', () => {
    expect(() => User.create({ ...validProps, name: '   ' })).toThrow(InvalidNameError);
  });

  it('applies changes through mutators, re-validating invariants', () => {
    const user = User.create(validProps);

    user.changeName('  Grace Hopper ');
    user.changeEmail(Email.create('Grace@Example.com'));

    expect(user.name).toBe('Grace Hopper');
    expect(user.email).toBe('grace@example.com');
    expect(() => user.changeName('   ')).toThrow(InvalidNameError);
  });

  it('reconstitutes a persisted user preserving every field', () => {
    const user = User.reconstitute(persistedProps, 'fixed-id');

    expect(user.id).toBe('fixed-id');
    expect(user.createdAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(user.hasPassword).toBe(false);
    expect(user.status).toBe('active');
  });

  it('starts without credentials and with login tracking at zero', () => {
    const user = User.create(validProps);

    expect(user.passwordHash).toBeNull();
    expect(user.hasPassword).toBe(false);
    expect(user.status).toBe('active');
    expect(user.failedLoginAttempts).toBe(0);
    expect(user.lockedUntil).toBeNull();
    expect(user.passwordChangedAt).toBeNull();
    expect(user.mustChangePassword).toBe(false);
    expect(user.lastLoginAt).toBeNull();
  });

  it('records the password change timestamp when created with a hash', () => {
    const user = User.create({ ...validProps, passwordHash: 'scrypt$hash' });

    expect(user.hasPassword).toBe(true);
    expect(user.passwordChangedAt).toBeInstanceOf(Date);
  });

  describe('password lifecycle', () => {
    it('sets the hash, the change timestamp and the forced-change flag', () => {
      const user = User.create(validProps);
      const changedAt = new Date('2026-02-01T10:00:00.000Z');

      user.setPassword('scrypt$new', { mustChange: true, changedAt });

      expect(user.passwordHash).toBe('scrypt$new');
      expect(user.passwordChangedAt).toEqual(changedAt);
      expect(user.mustChangePassword).toBe(true);
    });

    it('reports expiry from the last change and honours the disable value', () => {
      const user = User.create({ ...validProps, passwordHash: 'scrypt$hash' });
      const ninetyDaysLater = new Date(user.passwordChangedAt!.getTime() + 90 * 24 * 60 * 60 * 1000);

      expect(user.isPasswordExpiredAt(ninetyDaysLater, 90)).toBe(true);
      expect(user.isPasswordExpiredAt(new Date(), 90)).toBe(false);
      expect(user.isPasswordExpiredAt(ninetyDaysLater, 0)).toBe(false);
    });

    it('treats a hash without a change timestamp as expired', () => {
      const user = User.reconstitute({ ...persistedProps, passwordHash: 'scrypt$hash' }, 'u1');

      expect(user.isPasswordExpiredAt(new Date('2026-06-01T00:00:00.000Z'), 90)).toBe(true);
    });

    it('never reports expiry for accounts without a password', () => {
      const user = User.create(validProps);

      expect(user.isPasswordExpiredAt(new Date('2036-01-01T00:00:00.000Z'), 90)).toBe(false);
    });

    it('requires a password change after an admin reset or expiry', () => {
      const user = User.create(validProps);

      expect(user.requiresPasswordChangeAt(new Date(), 90)).toBe(false);

      user.setPassword('scrypt$hash', { mustChange: true });

      expect(user.requiresPasswordChangeAt(new Date(), 90)).toBe(true);
    });
  });

  describe('login attempts and lockout', () => {
    it('counts failures and clears them on success', () => {
      const user = User.create(validProps);

      user.registerFailedLogin();
      user.registerFailedLogin();

      expect(user.failedLoginAttempts).toBe(2);

      user.recordLoginSuccess(new Date('2026-03-01T09:00:00.000Z'));

      expect(user.failedLoginAttempts).toBe(0);
      expect(user.lockedUntil).toBeNull();
      expect(user.lastLoginAt).toEqual(new Date('2026-03-01T09:00:00.000Z'));
    });

    it('knows whether it is locked at a given moment', () => {
      const user = User.create(validProps);
      const now = new Date('2026-03-01T09:00:00.000Z');

      user.lockUntil(new Date('2026-03-01T09:15:00.000Z'));

      expect(user.isLockedAt(now)).toBe(true);
      expect(user.isLockedAt(new Date('2026-03-01T09:15:00.000Z'))).toBe(false);

      user.clearLoginFailures();

      expect(user.isLockedAt(now)).toBe(false);
    });
  });
});

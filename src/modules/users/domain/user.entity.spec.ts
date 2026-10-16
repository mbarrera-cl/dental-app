import { Email } from './email.vo.js';
import { User } from './user.entity.js';
import { InvalidEmailError, InvalidNameError } from './user.errors.js';

describe('User', () => {
  const validProps = { email: 'ada@example.com', name: 'Ada Lovelace' };

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

  it('reconstitutes a persisted user preserving its id', () => {
    const user = User.reconstitute(
      {
        email: Email.create('ada@example.com'),
        name: 'Ada Lovelace',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      'fixed-id',
    );

    expect(user.id).toBe('fixed-id');
    expect(user.createdAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
  });
});

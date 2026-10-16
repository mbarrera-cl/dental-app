import { Entity } from '../../../shared/domain/entity.js';
import { Email } from './email.vo.js';
import { InvalidNameError } from './user.errors.js';

export interface UserProps {
  email: Email;
  name: string;
  createdAt: Date;
}

export interface CreateUserProps {
  email: string;
  name: string;
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

  static create({ email, name }: CreateUserProps): User {
    return new User({
      email: Email.create(email),
      name: User.normalizeName(name),
      createdAt: new Date(),
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

  private static normalizeName(name: string): string {
    const normalized = name.trim();

    if (normalized.length === 0) {
      throw new InvalidNameError();
    }

    return normalized;
  }
}

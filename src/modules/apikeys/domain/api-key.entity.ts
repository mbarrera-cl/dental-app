import { Entity } from '../../../shared/domain/entity.js';
import { ApiKeyAlreadyRevokedError, InvalidApiKeyNameError } from './api-key.errors.js';

const NAME_MAX_LENGTH = 60;

export interface ApiKeyProps {
  userId: string;
  name: string;
  prefix: string;
  keyHash: string;
  /** `null` inherits every effective permission of the owner. */
  scopes: readonly string[] | null;
  /** `null` = the key never expires. */
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface CreateApiKeyProps {
  userId: string;
  name: string;
  prefix: string;
  keyHash: string;
  scopes?: readonly string[] | null;
  expiresAt?: Date | null;
  createdAt?: Date;
}

/**
 * A credential owned by a user that authenticates *as* that user. It may
 * scope down to a subset of the owner's permissions but never up: the
 * authenticator recomputes the intersection on every request, so revoking
 * a role or a direct grant shrinks the key immediately.
 */
export class ApiKey extends Entity<ApiKeyProps> {
  private constructor(props: ApiKeyProps, id?: string) {
    super(props, id);
  }

  static create({
    userId,
    name,
    prefix,
    keyHash,
    scopes = null,
    expiresAt = null,
    createdAt,
  }: CreateApiKeyProps): ApiKey {
    return new ApiKey({
      userId,
      name: ApiKey.normalizeName(name),
      prefix,
      keyHash,
      scopes: scopes === null ? null : [...new Set(scopes)],
      expiresAt,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: createdAt ?? new Date(),
    });
  }

  /** Rebuilds a key that already exists (e.g. loaded from a database). */
  static reconstitute(props: ApiKeyProps, id: string): ApiKey {
    return new ApiKey(props, id);
  }

  get userId(): string {
    return this.props.userId;
  }

  get name(): string {
    return this.props.name;
  }

  get prefix(): string {
    return this.props.prefix;
  }

  get keyHash(): string {
    return this.props.keyHash;
  }

  get scopes(): readonly string[] | null {
    return this.props.scopes;
  }

  get expiresAt(): Date | null {
    return this.props.expiresAt;
  }

  get lastUsedAt(): Date | null {
    return this.props.lastUsedAt;
  }

  get revokedAt(): Date | null {
    return this.props.revokedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get isRevoked(): boolean {
    return this.props.revokedAt !== null;
  }

  isExpired(now: Date): boolean {
    return this.props.expiresAt !== null && this.props.expiresAt.getTime() <= now.getTime();
  }

  /** Revoked and expired keys behave identically: they never authenticate. */
  isUsable(now: Date): boolean {
    return !this.isRevoked && !this.isExpired(now);
  }

  revoke(now: Date): void {
    if (this.isRevoked) {
      throw new ApiKeyAlreadyRevokedError(this.id);
    }

    this.props.revokedAt = now;
  }

  /** Rotation replaces the secret in place: same identity, same scopes. */
  rotateSecret(prefix: string, keyHash: string): void {
    if (this.isRevoked) {
      throw new ApiKeyAlreadyRevokedError(this.id);
    }

    this.props.prefix = prefix;
    this.props.keyHash = keyHash;
  }

  /** Called by the authenticator on every successful request. */
  touch(now: Date): void {
    this.props.lastUsedAt = now;
  }

  private static normalizeName(name: string): string {
    const normalized = name.trim();

    if (normalized.length === 0 || normalized.length > NAME_MAX_LENGTH) {
      throw new InvalidApiKeyNameError();
    }

    return normalized;
  }
}

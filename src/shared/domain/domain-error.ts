/**
 * Classifies a domain error so that edge adapters (HTTP, gRPC, CLI, ...) can
 * translate it to the appropriate transport status. The domain layer stays
 * completely unaware of transports: it only describes *what* went wrong.
 */
export type DomainErrorKind =
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'locked'
  | 'unsupported_media'
  | 'unexpected';

export interface DomainErrorOptions extends ErrorOptions {
  /**
   * Machine-readable context (violated rules, limits, offending keys, ...).
   * Edge adapters forward it to clients as-is, so keep it stable and
   * primitive-serializable.
   */
  details?: Readonly<Record<string, unknown>>;
}

/**
 * Base class for all errors that express a broken business rule.
 * Throw `DomainError` subclasses from entities, value objects and use cases;
 * infrastructure adapters decide how to present them to the outside world.
 */
export abstract class DomainError extends Error {
  abstract readonly kind: DomainErrorKind;

  readonly details?: Readonly<Record<string, unknown>>;

  protected constructor(message: string, options?: DomainErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.details = options?.details;
  }
}

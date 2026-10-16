/**
 * Classifies a domain error so that edge adapters (HTTP, gRPC, CLI, ...) can
 * translate it to the appropriate transport status. The domain layer stays
 * completely unaware of transports: it only describes *what* went wrong.
 */
export type DomainErrorKind = 'validation' | 'not_found' | 'conflict' | 'unexpected';

/**
 * Base class for all errors that express a broken business rule.
 * Throw `DomainError` subclasses from entities, value objects and use cases;
 * infrastructure adapters decide how to present them to the outside world.
 */
export abstract class DomainError extends Error {
  abstract readonly kind: DomainErrorKind;

  protected constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

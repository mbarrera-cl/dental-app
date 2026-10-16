import { randomUUID } from 'node:crypto';

/**
 * Base class for entities: two entities are equal when they share the same
 * identity, regardless of their attributes.
 *
 * Entities are constructed through factories (`create` / `reconstitute`) in
 * the concrete subclass. Pass an explicit `id` only when reconstituting an
 * entity that already has one (e.g. loaded from a database) — otherwise a
 * new UUID is generated.
 *
 * For stricter purity you could model id generation as an injected port, but
 * `crypto.randomUUID()` is deterministic enough and keeps the boilerplate
 * simple.
 */
export abstract class Entity<TProps> {
  readonly id: string;

  protected readonly props: TProps;

  protected constructor(props: TProps, id?: string) {
    this.props = props;
    this.id = id ?? randomUUID();
  }

  equals(other?: Entity<TProps>): boolean {
    if (other === undefined || other === null) {
      return false;
    }

    return this.id === other.id;
  }
}

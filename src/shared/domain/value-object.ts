/**
 * Base class for value objects: immutable and identified by their value,
 * not by an id. Keep `TProps` serializable (primitives or plain objects) so
 * the structural `equals` implementation below behaves as expected.
 *
 * Value objects are the right place to enforce small invariants, e.g. the
 * `Email` value object only ever exists in a valid, normalized state.
 */
export abstract class ValueObject<TProps> {
  protected readonly props: TProps;

  protected constructor(props: TProps) {
    this.props = Object.freeze(props);
  }

  equals(other?: ValueObject<TProps>): boolean {
    if (other === undefined || other === null) {
      return false;
    }

    return JSON.stringify(this.props) === JSON.stringify(other.props);
  }
}

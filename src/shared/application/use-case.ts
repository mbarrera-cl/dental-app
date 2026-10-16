/**
 * Every use case is a small, single-purpose class implementing this contract.
 *
 * - `TInput` is a command/query object owned by the application layer
 *   (typically defined right next to the use case).
 * - `TOutput` should be a domain object — the driving adapter (controller,
 *   message consumer, ...) maps it to its own representation.
 */
export interface UseCase<TInput, TOutput> {
  execute(input: TInput): Promise<TOutput>;
}

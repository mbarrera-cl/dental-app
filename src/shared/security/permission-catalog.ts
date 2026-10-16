/**
 * Permission catalog primitives.
 *
 * A permission is identified by its `resource:action` key (e.g.
 * `users:reset-password`). Resources — *categories* — map one-to-one with
 * bounded contexts: every module owns a `permissions.ts` file declaring its
 * category, and `shared/security/permissions.ts` aggregates them all.
 *
 * This keeps the catalog fully type-safe at code level (guards receive
 * constants, never bare strings) while staying data-driven at runtime: roles,
 * the API and the admin panel consume whatever the catalog exposes.
 */
export type PermissionKey = `${string}:${string}`;

/** Full permission keys of one category, keyed by camelCase action. */
export type PermissionCategoryKeys<
  TId extends string,
  TActions extends Readonly<Record<string, string>>,
> = {
  readonly [K in keyof TActions]: `${TId}:${string}`;
};

export interface PermissionCategory<TId extends string = string> {
  /** Resource id, e.g. `users`. */
  readonly id: TId;
  /** Developer-facing description (UI wording lives in the i18n dictionaries). */
  readonly description: string;
  /** camelCase action → developer-facing description. */
  readonly actions: Readonly<Record<string, string>>;
  /** camelCase action → full `resource:action` key. */
  readonly keys: Readonly<Record<string, PermissionKey>>;
  /** Every key of the category, in declaration order. */
  readonly permissionKeys: readonly PermissionKey[];
}

/**
 * Declares one permission category. Actions are written in camelCase
 * (`resetPassword`) and become kebab-case permission keys
 * (`users:reset-password`).
 */
export function defineCategory<TId extends string, TActions extends Readonly<Record<string, string>>>(
  id: TId,
  description: string,
  actions: TActions,
): PermissionCategory<TId> & { readonly keys: PermissionCategoryKeys<TId, TActions> } {
  const keys = Object.fromEntries(
    Object.keys(actions).map((action) => [action, `${id}:${toKebabCase(action)}`]),
  ) as PermissionCategoryKeys<TId, TActions>;

  return {
    id,
    description,
    actions,
    keys,
    permissionKeys: Object.values(keys),
  };
}

/** `resetPassword` → `reset-password`. */
export function toKebabCase(camelCase: string): string {
  return camelCase
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

import type { MenuItem } from '../../domain/menu-item.entity.js';

/**
 * Driven port for menu persistence. Entries are stored flat; trees are built
 * by the domain (`buildMenuTree`), so adapters only deal with rows.
 */
export abstract class MenuRepositoryPort {
  /**
   * Every stored entry. Order is stable (insertion order) — it is the
   * tie-breaker when reordering normalizes positions.
   */
  abstract findAll(): Promise<MenuItem[]>;

  abstract findById(id: string): Promise<MenuItem | null>;

  /** Highest position among the children of `parentId`, or `null` when none. */
  abstract maxPosition(parentId: string | null): Promise<number | null>;

  abstract count(): Promise<number>;

  /** Inserts a brand-new entry. */
  abstract save(item: MenuItem): Promise<void>;

  /** Updates an existing entry; throws `MenuItemNotFoundError` when missing. */
  abstract update(item: MenuItem): Promise<void>;

  /** Updates many entries atomically (reordering). */
  abstract saveMany(items: readonly MenuItem[]): Promise<void>;

  /** Deletes an entry; children are removed by the foreign key cascade. */
  abstract delete(id: string): Promise<void>;

  /**
   * Atomically replaces the whole menu (default seed / reset). Items must be
   * passed parent-first.
   */
  abstract replaceAll(items: readonly MenuItem[]): Promise<void>;
}

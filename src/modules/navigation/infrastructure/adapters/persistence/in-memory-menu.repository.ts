import { MenuRepositoryPort } from '../../../application/ports/menu-repository.port.js';
import type { MenuItem } from '../../../domain/menu-item.entity.js';
import { MenuItemNotFoundError } from '../../../domain/menu-item.errors.js';

/**
 * In-memory adapter used by unit tests (and usable as a stub in any other
 * context). Mirrors the SQLite behaviour: insertion-order reads, cascade on
 * delete and not-found errors on updates.
 */
export class InMemoryMenuRepository extends MenuRepositoryPort {
  private items: MenuItem[] = [];

  async findAll(): Promise<MenuItem[]> {
    return [...this.items];
  }

  async findById(id: string): Promise<MenuItem | null> {
    return this.items.find((item) => item.id === id) ?? null;
  }

  async maxPosition(parentId: string | null): Promise<number | null> {
    const positions = this.items
      .filter((item) => item.parentId === parentId)
      .map((item) => item.position);

    return positions.length === 0 ? null : Math.max(...positions);
  }

  async count(): Promise<number> {
    return this.items.length;
  }

  async save(item: MenuItem): Promise<void> {
    this.items.push(item);
  }

  async update(item: MenuItem): Promise<void> {
    const index = this.items.findIndex((existing) => existing.id === item.id);

    if (index === -1) {
      throw new MenuItemNotFoundError(item.id);
    }

    this.items[index] = item;
  }

  async saveMany(items: readonly MenuItem[]): Promise<void> {
    for (const item of items) {
      await this.update(item);
    }
  }

  async delete(id: string): Promise<void> {
    if (!this.items.some((item) => item.id === id)) {
      throw new MenuItemNotFoundError(id);
    }

    this.items = this.items.filter((item) => item.id !== id && item.parentId !== id);
  }

  async replaceAll(items: readonly MenuItem[]): Promise<void> {
    this.items = [...items];
  }
}

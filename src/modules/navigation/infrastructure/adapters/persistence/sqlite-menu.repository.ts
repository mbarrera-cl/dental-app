import { Injectable } from '@nestjs/common';
import { SqliteDatabase } from '../../../../../shared/infrastructure/database/sqlite-database.js';
import { MenuRepositoryPort } from '../../../application/ports/menu-repository.port.js';
import { MenuItem, type MenuKind } from '../../../domain/menu-item.entity.js';
import { MenuItemNotFoundError } from '../../../domain/menu-item.errors.js';

interface MenuItemRow {
  id: string;
  parent_id: string | null;
  kind: string;
  label: string | null;
  icon: string | null;
  route_key: string | null;
  external_url: string | null;
  position: number;
  required_permission: string | null;
  enabled: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

const UPDATE_SQL = `
  UPDATE menu_items
  SET parent_id = ?, label = ?, icon = ?, route_key = ?, external_url = ?, position = ?,
      required_permission = ?, enabled = ?, updated_at = ?, updated_by = ?
  WHERE id = ?
`;

const INSERT_SQL = `
  INSERT INTO menu_items
    (id, parent_id, kind, label, icon, route_key, external_url, position,
     required_permission, enabled, created_at, updated_at, created_by, updated_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

/**
 * Driven adapter backed by SQLite. `menu_items` is created by the shared
 * schema (`ensureSchema`) and `parent_id` cascades on delete, so removing a
 * group removes its children atomically.
 */
@Injectable()
export class SqliteMenuRepository extends MenuRepositoryPort {
  constructor(private readonly database: SqliteDatabase) {
    super();
  }

  async findAll(): Promise<MenuItem[]> {
    // `rowid` is insertion order: the stable tie-breaker the reorder use
    // case relies on when positions collide.
    const rows = this.database.connection
      .prepare('SELECT * FROM menu_items ORDER BY rowid ASC')
      .all() as unknown as MenuItemRow[];

    return rows.map((row) => this.toDomain(row));
  }

  async findById(id: string): Promise<MenuItem | null> {
    const row = this.database.connection
      .prepare('SELECT * FROM menu_items WHERE id = ?')
      .get(id) as unknown as MenuItemRow | undefined;

    return row === undefined ? null : this.toDomain(row);
  }

  async maxPosition(parentId: string | null): Promise<number | null> {
    const row = this.database.connection
      .prepare('SELECT MAX(position) AS max FROM menu_items WHERE parent_id IS ?')
      .get(parentId) as unknown as { max: number | null };

    return row.max === null ? null : Number(row.max);
  }

  async count(): Promise<number> {
    const row = this.database.connection
      .prepare('SELECT COUNT(*) AS count FROM menu_items')
      .get() as unknown as { count: number };

    return Number(row.count);
  }

  async save(item: MenuItem): Promise<void> {
    this.insertRow(item);
  }

  async update(item: MenuItem): Promise<void> {
    this.updateRow(item);
  }

  async saveMany(items: readonly MenuItem[]): Promise<void> {
    this.transaction(() => {
      for (const item of items) {
        this.updateRow(item);
      }
    });
  }

  async delete(id: string): Promise<void> {
    const result = this.database.connection.prepare('DELETE FROM menu_items WHERE id = ?').run(id);

    if (result.changes === 0) {
      throw new MenuItemNotFoundError(id);
    }
  }

  async replaceAll(items: readonly MenuItem[]): Promise<void> {
    this.transaction(() => {
      this.database.connection.prepare('DELETE FROM menu_items').run();

      for (const item of items) {
        this.insertRow(item);
      }
    });
  }

  private insertRow(item: MenuItem): void {
    this.database.connection
      .prepare(INSERT_SQL)
      .run(
        item.id,
        item.parentId,
        item.kind,
        item.label,
        item.icon,
        item.routeKey,
        item.externalUrl,
        item.position,
        item.requiredPermission,
        item.enabled ? 1 : 0,
        item.createdAt.toISOString(),
        item.updatedAt.toISOString(),
        item.createdBy,
        item.updatedBy,
      );
  }

  private updateRow(item: MenuItem): void {
    const result = this.database.connection
      .prepare(UPDATE_SQL)
      .run(
        item.parentId,
        item.label,
        item.icon,
        item.routeKey,
        item.externalUrl,
        item.position,
        item.requiredPermission,
        item.enabled ? 1 : 0,
        item.updatedAt.toISOString(),
        item.updatedBy,
        item.id,
      );

    if (result.changes === 0) {
      throw new MenuItemNotFoundError(item.id);
    }
  }

  private transaction<T>(work: () => T): T {
    this.database.connection.exec('BEGIN');

    try {
      const result = work();
      this.database.connection.exec('COMMIT');
      return result;
    } catch (error) {
      this.database.connection.exec('ROLLBACK');
      throw error;
    }
  }

  private toDomain(row: MenuItemRow): MenuItem {
    return MenuItem.reconstitute(
      {
        parentId: row.parent_id,
        kind: row.kind as MenuKind,
        label: row.label,
        icon: row.icon,
        routeKey: row.route_key,
        externalUrl: row.external_url,
        position: Number(row.position),
        requiredPermission: row.required_permission,
        enabled: row.enabled === 1,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        createdBy: row.created_by,
        updatedBy: row.updated_by,
      },
      row.id,
    );
  }
}

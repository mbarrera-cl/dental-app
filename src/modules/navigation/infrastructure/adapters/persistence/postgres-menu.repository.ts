import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { PostgresDatabase, isUuid } from '../../../../../shared/infrastructure/database/postgres-database.js';
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
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
}

const INSERT_SQL = `
  INSERT INTO menu_items
    (id, parent_id, kind, label, icon, route_key, external_url, position,
     required_permission, enabled, created_at, updated_at, created_by, updated_by)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
`;

@Injectable()
export class PostgresMenuRepository extends MenuRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async findAll(): Promise<MenuItem[]> {
    const rows = await this.db.query<MenuItemRow>(
      'SELECT * FROM menu_items ORDER BY seq ASC',
    );

    return rows.map((row) => this.toDomain(row));
  }

  async findById(id: string): Promise<MenuItem | null> {
    if (!isUuid(id)) {
      return null;
    }

    const row = await this.db.queryOne<MenuItemRow>('SELECT * FROM menu_items WHERE id = $1', [id]);
    return row === null ? null : this.toDomain(row);
  }

  async maxPosition(parentId: string | null): Promise<number | null> {
    if (parentId !== null && !isUuid(parentId)) {
      return null;
    }

    const row = await this.db.queryOne<{ max: number | null }>(
      'SELECT MAX(position) AS max FROM menu_items WHERE parent_id IS NOT DISTINCT FROM $1',
      [parentId],
    );

    return row?.max === null || row?.max === undefined ? null : Number(row.max);
  }

  async count(): Promise<number> {
    const row = await this.db.queryOne<{ count: string | number }>('SELECT COUNT(*) AS count FROM menu_items');
    return Number(row?.count ?? 0);
  }

  async save(item: MenuItem): Promise<void> {
    await this.insert(item);
  }

  async update(item: MenuItem): Promise<void> {
    await this.updateRow(item);
  }

  async saveMany(items: readonly MenuItem[]): Promise<void> {
    await this.db.transaction(async (client) => {
      for (const item of items) {
        await this.updateRow(item, client);
      }
    });
  }

  async delete(id: string): Promise<void> {
    if (!isUuid(id)) {
      throw new MenuItemNotFoundError(id);
    }

    const changed = await this.db.execute('DELETE FROM menu_items WHERE id = $1', [id]);

    if (changed === 0) {
      throw new MenuItemNotFoundError(id);
    }
  }

  async replaceAll(items: readonly MenuItem[]): Promise<void> {
    await this.db.transaction(async (client) => {
      await client.query('DELETE FROM menu_items');

      for (const item of items) {
        await this.insert(item, client);
      }
    });
  }

  private async insert(
    item: MenuItem,
    client?: PoolClient,
  ): Promise<void> {
    const params = [
      item.id,
      item.parentId,
      item.kind,
      item.label,
      item.icon,
      item.routeKey,
      item.externalUrl,
      item.position,
      item.requiredPermission,
      item.enabled,
      item.createdAt,
      item.updatedAt,
      item.createdBy,
      item.updatedBy,
    ];

    if (client === undefined) {
      await this.db.execute(INSERT_SQL, params);
    } else {
      await client.query(INSERT_SQL, params);
    }
  }

  private async updateRow(
    item: MenuItem,
    client?: PoolClient,
  ): Promise<void> {
    if (!isUuid(item.id)) {
      throw new MenuItemNotFoundError(item.id);
    }

    const sql = `
      UPDATE menu_items
      SET parent_id = $1, label = $2, icon = $3, route_key = $4,
          external_url = $5, position = $6, required_permission = $7,
          enabled = $8, updated_at = $9, updated_by = $10
      WHERE id = $11
    `;
    const params = [
      item.parentId,
      item.label,
      item.icon,
      item.routeKey,
      item.externalUrl,
      item.position,
      item.requiredPermission,
      item.enabled,
      item.updatedAt,
      item.updatedBy,
      item.id,
    ];
    let changed: number;

    if (client === undefined) {
      changed = await this.db.execute(sql, params);
    } else {
      const result = await client.query(sql, params);
      changed = result.rowCount ?? 0;
    }

    if (changed === 0) {
      throw new MenuItemNotFoundError(item.id);
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
        enabled: row.enabled,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        createdBy: row.created_by,
        updatedBy: row.updated_by,
      },
      row.id,
    );
  }
}

import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { MenuRepositoryPort } from '../../application/ports/menu-repository.port.js';
import { PostgresDatabase } from '../../../../shared/infrastructure/database/postgres-database.js';
import { caroIaPermissions } from '../../../caro-ia/permissions.js';
import { buildDefaultMenuItems } from '../../domain/default-menu.js';
import { MenuItem } from '../../domain/menu-item.entity.js';

/**
 * Brings a fresh (or emptied) database to a usable state by seeding the
 * default menu. Idempotent: a non-empty table is left untouched — cleaning
 * an existing menu is an explicit administrator action (`POST
 * /navigation/reset`), never a surprise boot-time overwrite.
 */
@Injectable()
export class NavigationBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(NavigationBootstrapService.name);

  private static readonly CARO_IA_MARKER = 'navigation.caroIa.seeded';

  constructor(
    private readonly menu: MenuRepositoryPort,
    private readonly database: PostgresDatabase,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if ((await this.menu.count()) > 0) {
      await this.ensureCaroIaEntry();
      return;
    }

    const items = buildDefaultMenuItems();
    await this.menu.replaceAll(items);
    await this.setMarker();

    this.logger.log(`Seeded the default menu (${items.length} entries)`);
  }

  /**
   * CaroIA shipped after the first menu seed. Existing installations get the
   * new entry once; an administrator may still delete or reorder it later.
   */
  private async ensureCaroIaEntry(): Promise<void> {
    if (await this.hasMarker()) {
      return;
    }

    const items = await this.menu.findAll();

    if (items.some((item) => item.routeKey === 'caroIa')) {
      await this.setMarker();
      return;
    }

    const lastPosition = (await this.menu.maxPosition(null)) ?? -1;
    const item = MenuItem.create({
      kind: 'item',
      icon: 'lucideSparkles',
      routeKey: 'caroIa',
      requiredPermission: caroIaPermissions.use,
    });

    item.setPosition(lastPosition + 1);
    await this.menu.save(item);
    await this.setMarker();
    this.logger.log('Added the CaroIA entry to the existing menu');
  }

  private async hasMarker(): Promise<boolean> {
    const row = await this.database.queryOne<{ value: string }>(
      'SELECT value FROM bootstrap_state WHERE key = $1',
      [NavigationBootstrapService.CARO_IA_MARKER],
    );

    return row !== null;
  }

  private async setMarker(): Promise<void> {
    await this.database.execute(
      `INSERT INTO bootstrap_state (key, value) VALUES ($1, '1')
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [NavigationBootstrapService.CARO_IA_MARKER],
    );
  }
}

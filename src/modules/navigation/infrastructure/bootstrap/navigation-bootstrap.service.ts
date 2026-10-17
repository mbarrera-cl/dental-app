import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { MenuRepositoryPort } from '../../application/ports/menu-repository.port.js';
import { buildDefaultMenuItems } from '../../domain/default-menu.js';

/**
 * Brings a fresh (or emptied) database to a usable state by seeding the
 * default menu. Idempotent: a non-empty table is left untouched — cleaning
 * an existing menu is an explicit administrator action (`POST
 * /navigation/reset`), never a surprise boot-time overwrite.
 */
@Injectable()
export class NavigationBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(NavigationBootstrapService.name);

  constructor(private readonly menu: MenuRepositoryPort) {}

  async onApplicationBootstrap(): Promise<void> {
    if ((await this.menu.count()) > 0) {
      return;
    }

    const items = buildDefaultMenuItems();
    await this.menu.replaceAll(items);

    this.logger.log(`Seeded the default menu (${items.length} entries)`);
  }
}

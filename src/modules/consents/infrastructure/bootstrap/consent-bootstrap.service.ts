import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConsentTemplateRepositoryPort } from '../../application/ports/consent-template-repository.port.js';
import { CONSENT_SEED } from '../../domain/consent-seed.js';
import { ConsentTemplate } from '../../domain/consent-template.entity.js';
import { ConsentTemplateAlreadyExistsError } from '../../domain/consent.errors.js';

/**
 * Seeds the base informed-consent templates on a fresh database. Idempotent:
 * when any template already exists the seed is skipped, so edits made from the
 * admin panel survive a restart.
 */
@Injectable()
export class ConsentBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ConsentBootstrapService.name);

  constructor(private readonly templates: ConsentTemplateRepositoryPort) {}

  async onApplicationBootstrap(): Promise<void> {
    const existing = await this.templates.findAll(true);

    if (existing.length > 0) {
      return;
    }

    for (const seed of CONSENT_SEED) {
      try {
        await this.templates.save(ConsentTemplate.create(seed));
      } catch (error) {
        // Another instance may have seeded the same key concurrently.
        if (!(error instanceof ConsentTemplateAlreadyExistsError)) {
          throw error;
        }
      }
    }

    this.logger.log(`Seeded ${CONSENT_SEED.length} informed-consent templates`);
  }
}

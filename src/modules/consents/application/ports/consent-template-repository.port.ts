import type { ConsentTemplate } from '../../domain/consent-template.entity.js';

/**
 * Driven port (secondary port): persistence contract of consent templates.
 * Concrete adapters live in `infrastructure/adapters` and are bound to this
 * class in the feature module (composition root).
 */
export abstract class ConsentTemplateRepositoryPort {
  abstract save(template: ConsentTemplate): Promise<void>;

  /** Updates an existing template; throws when it no longer exists. */
  abstract update(template: ConsentTemplate): Promise<void>;

  abstract findByKey(key: string): Promise<ConsentTemplate | null>;

  abstract findAll(includeInactive: boolean): Promise<ConsentTemplate[]>;
}

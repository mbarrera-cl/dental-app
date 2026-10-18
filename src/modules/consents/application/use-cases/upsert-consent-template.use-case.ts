import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import {
  ConsentTemplate,
  normalizeConsentKey,
} from '../../domain/consent-template.entity.js';
import { ConsentTemplateRepositoryPort } from '../ports/consent-template-repository.port.js';

export interface UpsertConsentTemplateCommand {
  key: string;
  title: string;
  body: string;
  active?: boolean;
}

/**
 * Creates a template when the key is new, or edits it in place. The key is
 * the business identifier; editing the wording bumps the template version.
 */
@Injectable()
export class UpsertConsentTemplateUseCase implements UseCase<
  UpsertConsentTemplateCommand,
  ConsentTemplate
> {
  constructor(private readonly templates: ConsentTemplateRepositoryPort) {}

  async execute(command: UpsertConsentTemplateCommand): Promise<ConsentTemplate> {
    const key = normalizeConsentKey(command.key);
    const existing = await this.templates.findByKey(key);

    if (existing === null) {
      const template = ConsentTemplate.create({
        key,
        title: command.title,
        body: command.body,
        active: command.active ?? true,
      });

      await this.templates.save(template);

      return template;
    }

    existing.update({
      title: command.title,
      body: command.body,
      active: command.active,
    });

    await this.templates.update(existing);

    return existing;
  }
}

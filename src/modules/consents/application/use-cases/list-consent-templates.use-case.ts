import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ConsentTemplateRepositoryPort } from '../ports/consent-template-repository.port.js';
import { ConsentTemplate } from '../../domain/consent-template.entity.js';

export interface ListConsentTemplatesCommand {
  includeInactive?: boolean;
}

@Injectable()
export class ListConsentTemplatesUseCase implements UseCase<
  ListConsentTemplatesCommand,
  ConsentTemplate[]
> {
  constructor(private readonly templates: ConsentTemplateRepositoryPort) {}

  async execute({
    includeInactive = false,
  }: ListConsentTemplatesCommand): Promise<ConsentTemplate[]> {
    return this.templates.findAll(includeInactive);
  }
}

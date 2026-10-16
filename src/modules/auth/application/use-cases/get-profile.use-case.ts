import { Injectable } from '@nestjs/common';
import { AuthenticationRequiredError } from '../../../../shared/security/authentication.errors.js';
import type { Principal } from '../../../../shared/security/principal.js';
import { UserRepositoryPort } from '../../../users/application/ports/user-repository.port.js';
import { SessionService, type AuthProfile } from '../session.service.js';

/**
 * Profile of the authenticated principal with the permission breakdown
 * (`fromRoles` / `direct` / `effective`) the UI uses to explain access.
 */
@Injectable()
export class GetProfileUseCase {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly session: SessionService,
  ) {}

  async execute(principal: Principal): Promise<AuthProfile> {
    const user = await this.users.findById(principal.userId);

    if (user === null || user.status !== 'active') {
      throw new AuthenticationRequiredError();
    }

    return this.session.describe(user);
  }
}

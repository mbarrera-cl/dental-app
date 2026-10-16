import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { RoleNotFoundError } from '../../domain/role.errors.js';
import { RoleRepositoryPort, type RoleWithUsage } from '../ports/role-repository.port.js';

export interface GetRoleCommand {
  id: string;
}

@Injectable()
export class GetRoleUseCase implements UseCase<GetRoleCommand, RoleWithUsage> {
  constructor(private readonly roleRepository: RoleRepositoryPort) {}

  async execute({ id }: GetRoleCommand): Promise<RoleWithUsage> {
    const role = await this.roleRepository.findById(id);

    if (role === null) {
      throw new RoleNotFoundError(id);
    }

    return role;
  }
}

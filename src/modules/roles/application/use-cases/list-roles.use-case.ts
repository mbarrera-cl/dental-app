import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { RoleRepositoryPort, type RoleWithUsage } from '../ports/role-repository.port.js';

@Injectable()
export class ListRolesUseCase implements UseCase<void, RoleWithUsage[]> {
  constructor(private readonly roleRepository: RoleRepositoryPort) {}

  async execute(): Promise<RoleWithUsage[]> {
    return this.roleRepository.findAll();
  }
}

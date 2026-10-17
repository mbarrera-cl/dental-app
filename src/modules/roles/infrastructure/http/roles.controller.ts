import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../../../../shared/security/require-permissions.decorator.js';
import {
  ActivityAction,
  personNameLabel,
} from '../../../activity/infrastructure/http/activity-action.decorator.js';
import { CreateRoleUseCase } from '../../application/use-cases/create-role.use-case.js';
import { DeleteRoleUseCase } from '../../application/use-cases/delete-role.use-case.js';
import { GetRoleUseCase } from '../../application/use-cases/get-role.use-case.js';
import { ListRolesUseCase } from '../../application/use-cases/list-roles.use-case.js';
import { UpdateRoleUseCase } from '../../application/use-cases/update-role.use-case.js';
import { rolesPermissions } from '../../permissions.js';
import { CreateRoleRequestDto } from './dtos/create-role.request.dto.js';
import { RoleResponseDto } from './dtos/role-response.dto.js';
import { UpdateRoleRequestDto } from './dtos/update-role.request.dto.js';

@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(
    private readonly createRole: CreateRoleUseCase,
    private readonly getRole: GetRoleUseCase,
    private readonly listRoles: ListRolesUseCase,
    private readonly updateRole: UpdateRoleUseCase,
    private readonly deleteRole: DeleteRoleUseCase,
  ) {}

  @Post()
  @RequirePermissions(rolesPermissions.create)
  @ActivityAction({
    action: 'roles.create',
    subjectType: 'role',
    subjectLabel: personNameLabel,
  })
  @ApiOperation({ summary: 'Create a role with any subset of the permission catalog' })
  @ApiCreatedResponse({ type: RoleResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid name or unknown permission key.' })
  @ApiConflictResponse({ description: 'A role with this name already exists.' })
  async create(@Body() body: CreateRoleRequestDto): Promise<RoleResponseDto> {
    const role = await this.createRole.execute({
      name: body.name,
      description: body.description,
      permissions: body.permissions,
    });

    // A brand-new role cannot be assigned to anyone yet.
    return RoleResponseDto.fromDomain({ role, userCount: 0 });
  }

  @Get()
  @RequirePermissions(rolesPermissions.read)
  @ApiOperation({ summary: 'List roles with the number of users each is assigned to' })
  @ApiOkResponse({ type: [RoleResponseDto] })
  async findAll(): Promise<RoleResponseDto[]> {
    const roles = await this.listRoles.execute();

    return roles.map((role) => RoleResponseDto.fromDomain(role));
  }

  @Get(':id')
  @RequirePermissions(rolesPermissions.read)
  @ApiOperation({ summary: 'Get a role by id' })
  @ApiOkResponse({ type: RoleResponseDto })
  @ApiNotFoundResponse({ description: 'No role with this id exists.' })
  async findOne(@Param('id') id: string): Promise<RoleResponseDto> {
    const role = await this.getRole.execute({ id });

    return RoleResponseDto.fromDomain(role);
  }

  @Patch(':id')
  @RequirePermissions(rolesPermissions.update)
  @ActivityAction({
    action: 'roles.update',
    subjectType: 'role',
    subjectParam: 'id',
    subjectLabel: personNameLabel,
  })
  @ApiOperation({ summary: 'Update a role (partial; the built-in admin role is protected)' })
  @ApiOkResponse({ type: RoleResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid payload, unknown permission or a protection rule.' })
  @ApiNotFoundResponse({ description: 'No role with this id exists.' })
  @ApiConflictResponse({ description: 'The new name is already taken.' })
  async update(@Param('id') id: string, @Body() body: UpdateRoleRequestDto): Promise<RoleResponseDto> {
    const role = await this.updateRole.execute({
      id,
      name: body.name,
      description: body.description,
      permissions: body.permissions,
    });

    return RoleResponseDto.fromDomain(role);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(rolesPermissions.delete)
  @ActivityAction({
    action: 'roles.delete',
    subjectType: 'role',
    subjectParam: 'id',
  })
  @ApiOperation({ summary: 'Delete a role (the built-in admin role and assigned roles are protected)' })
  @ApiNoContentResponse({ description: 'The role was deleted.' })
  @ApiNotFoundResponse({ description: 'No role with this id exists.' })
  @ApiConflictResponse({ description: 'The role is still assigned to users.' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.deleteRole.execute({ id });
  }
}

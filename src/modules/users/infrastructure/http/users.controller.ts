import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
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
import { CreateUserUseCase } from '../../application/use-cases/create-user.use-case.js';
import { DeleteUserUseCase } from '../../application/use-cases/delete-user.use-case.js';
import { GetUserUseCase } from '../../application/use-cases/get-user.use-case.js';
import { ListUsersUseCase } from '../../application/use-cases/list-users.use-case.js';
import { SetUserPasswordUseCase } from '../../application/use-cases/set-user-password.use-case.js';
import { UpdateUserPermissionsUseCase } from '../../application/use-cases/update-user-permissions.use-case.js';
import { UpdateUserUseCase } from '../../application/use-cases/update-user.use-case.js';
import { RequirePermissions } from '../../../../shared/security/require-permissions.decorator.js';
import { UserAccessReaderPort } from '../../../../shared/security/user-access.reader.port.js';
import {
  ActivityAction,
  personNameLabel,
} from '../../../activity/infrastructure/http/activity-action.decorator.js';
import type { User } from '../../domain/user.entity.js';
import { usersPermissions } from '../../permissions.js';
import { CreateUserRequestDto } from './dtos/create-user.request.dto.js';
import { SetUserPasswordRequestDto } from './dtos/set-user-password.request.dto.js';
import { SetUserPasswordResponseDto } from './dtos/set-user-password.response.dto.js';
import { UpdateUserPermissionsRequestDto } from './dtos/update-user-permissions.request.dto.js';
import { UpdateUserRequestDto } from './dtos/update-user.request.dto.js';
import { UserResponseDto } from './dtos/user-response.dto.js';

/**
 * Driving adapter: translates HTTP requests into use case calls and domain
 * objects back into HTTP responses. It contains no business logic.
 */
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly createUser: CreateUserUseCase,
    private readonly getUser: GetUserUseCase,
    private readonly listUsers: ListUsersUseCase,
    private readonly updateUser: UpdateUserUseCase,
    private readonly deleteUser: DeleteUserUseCase,
    private readonly setUserPassword: SetUserPasswordUseCase,
    private readonly updateUserPermissions: UpdateUserPermissionsUseCase,
    private readonly access: UserAccessReaderPort,
  ) {}

  @Post()
  @RequirePermissions(usersPermissions.create)
  @ActivityAction({
    action: 'users.create',
    subjectType: 'user',
    subjectLabel: personNameLabel,
  })
  @ApiOperation({ summary: 'Create a user' })
  @ApiCreatedResponse({ type: UserResponseDto, description: 'The user was created.' })
  @ApiBadRequestResponse({
    description: 'The payload failed validation, the password breaks the policy or a role id is unknown.',
  })
  @ApiConflictResponse({ description: 'A user with this email already exists.' })
  async create(@Body() body: CreateUserRequestDto): Promise<UserResponseDto> {
    const user = await this.createUser.execute({
      email: body.email,
      name: body.name,
      password: body.password,
      roles: body.roles,
      status: body.status,
    });

    return this.toDto(user);
  }

  @Get()
  @RequirePermissions(usersPermissions.read)
  @ApiOperation({ summary: 'List users' })
  @ApiOkResponse({ type: [UserResponseDto] })
  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.listUsers.execute();

    return Promise.all(users.map((user) => this.toDto(user)));
  }

  @Get(':id')
  @RequirePermissions(usersPermissions.read)
  @ApiOperation({ summary: 'Get a user by id' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse({ description: 'No user with this id exists.' })
  async findOne(@Param('id') id: string): Promise<UserResponseDto> {
    const user = await this.getUser.execute({ id });

    return this.toDto(user);
  }

  @Patch(':id')
  @RequirePermissions(usersPermissions.update)
  @ActivityAction({
    action: 'users.update',
    subjectType: 'user',
    subjectParam: 'id',
    subjectLabel: personNameLabel,
  })
  @ApiOperation({ summary: 'Update a user (partial: profile, roles and status)' })
  @ApiOkResponse({ type: UserResponseDto, description: 'The updated user.' })
  @ApiBadRequestResponse({ description: 'The payload failed validation or is empty.' })
  @ApiNotFoundResponse({ description: 'No user with this id exists.' })
  @ApiConflictResponse({
    description: 'The new email is already taken, or the change would remove the last administrator.',
  })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateUserRequestDto,
  ): Promise<UserResponseDto> {
    const user = await this.updateUser.execute({
      id,
      name: body.name,
      email: body.email,
      roles: body.roles,
      status: body.status,
    });

    return this.toDto(user);
  }

  @Post(':id/password')
  @RequirePermissions(usersPermissions.resetPassword)
  @ActivityAction({
    action: 'users.reset-password',
    subjectType: 'user',
    subjectParam: 'id',
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset the password of a user (typed or server-generated)' })
  @ApiOkResponse({
    type: SetUserPasswordResponseDto,
    description: 'Password reset. The generated password is returned exactly once.',
  })
  @ApiBadRequestResponse({
    description: 'No candidate was provided or it breaks the password policy.',
  })
  @ApiNotFoundResponse({ description: 'No user with this id exists.' })
  async resetPassword(
    @Param('id') id: string,
    @Body() body: SetUserPasswordRequestDto,
  ): Promise<SetUserPasswordResponseDto> {
    const result = await this.setUserPassword.execute({
      id,
      password: body.password,
      generate: body.generate,
    });

    const dto = new SetUserPasswordResponseDto();

    if (result.password !== null) {
      dto.password = result.password;
    }

    return dto;
  }

  @Put(':id/permissions')
  @RequirePermissions(usersPermissions.permissions)
  @ActivityAction({
    action: 'users.permissions',
    subjectType: 'user',
    subjectParam: 'id',
  })
  @ApiOperation({ summary: 'Replace the direct (non-role) permissions of a user' })
  @ApiOkResponse({ type: UserResponseDto, description: 'The updated user.' })
  @ApiBadRequestResponse({ description: 'One or more permission keys are not in the catalog.' })
  @ApiNotFoundResponse({ description: 'No user with this id exists.' })
  async updatePermissions(
    @Param('id') id: string,
    @Body() body: UpdateUserPermissionsRequestDto,
  ): Promise<UserResponseDto> {
    const user = await this.updateUserPermissions.execute({
      id,
      permissions: body.permissions,
    });

    return this.toDto(user);
  }

  @Delete(':id')
  @RequirePermissions(usersPermissions.delete)
  @ActivityAction({
    action: 'users.delete',
    subjectType: 'user',
    subjectParam: 'id',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user' })
  @ApiNoContentResponse({ description: 'The user was deleted.' })
  @ApiNotFoundResponse({ description: 'No user with this id exists.' })
  @ApiConflictResponse({ description: 'The user is the last active administrator.' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.deleteUser.execute({ id });
  }

  /** Enriches a domain user with its roles and direct permissions. */
  private async toDto(user: User): Promise<UserResponseDto> {
    const access = await this.access.load(user.id);

    return UserResponseDto.fromDomain(user, access);
  }
}

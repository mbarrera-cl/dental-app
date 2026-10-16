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
import { UpdateUserUseCase } from '../../application/use-cases/update-user.use-case.js';
import { CreateUserRequestDto } from './dtos/create-user.request.dto.js';
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
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a user' })
  @ApiCreatedResponse({ type: UserResponseDto, description: 'The user was created.' })
  @ApiBadRequestResponse({ description: 'The payload failed validation.' })
  @ApiConflictResponse({ description: 'A user with this email already exists.' })
  async create(@Body() body: CreateUserRequestDto): Promise<UserResponseDto> {
    const user = await this.createUser.execute({
      email: body.email,
      name: body.name,
    });

    return UserResponseDto.fromDomain(user);
  }

  @Get()
  @ApiOperation({ summary: 'List users' })
  @ApiOkResponse({ type: [UserResponseDto] })
  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.listUsers.execute();

    return users.map((user) => UserResponseDto.fromDomain(user));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by id' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse({ description: 'No user with this id exists.' })
  async findOne(@Param('id') id: string): Promise<UserResponseDto> {
    const user = await this.getUser.execute({ id });

    return UserResponseDto.fromDomain(user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user (partial)' })
  @ApiOkResponse({ type: UserResponseDto, description: 'The updated user.' })
  @ApiBadRequestResponse({ description: 'The payload failed validation or is empty.' })
  @ApiNotFoundResponse({ description: 'No user with this id exists.' })
  @ApiConflictResponse({ description: 'The new email is already taken.' })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateUserRequestDto,
  ): Promise<UserResponseDto> {
    const user = await this.updateUser.execute({
      id,
      name: body.name,
      email: body.email,
    });

    return UserResponseDto.fromDomain(user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user' })
  @ApiNoContentResponse({ description: 'The user was deleted.' })
  @ApiNotFoundResponse({ description: 'No user with this id exists.' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.deleteUser.execute({ id });
  }
}

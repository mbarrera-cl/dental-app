import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateUserUseCase } from '../../application/use-cases/create-user.use-case.js';
import { GetUserUseCase } from '../../application/use-cases/get-user.use-case.js';
import { ListUsersUseCase } from '../../application/use-cases/list-users.use-case.js';
import { CreateUserRequestDto } from './dtos/create-user.request.dto.js';
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
}

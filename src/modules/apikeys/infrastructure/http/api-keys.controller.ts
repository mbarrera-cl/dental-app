import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticationRequiredError } from '../../../../shared/security/authentication.errors.js';
import { PermissionDeniedError } from '../../../../shared/security/permission.errors.js';
import type { Principal } from '../../../../shared/security/principal.js';
import type { AuthenticatedRequest } from '../../../../shared/security/authenticated-request.js';
import { RequireAnyPermissions } from '../../../../shared/security/require-any-permissions.decorator.js';
import { CreateApiKeyUseCase } from '../../application/use-cases/create-api-key.use-case.js';
import { GetApiKeyUseCase } from '../../application/use-cases/get-api-key.use-case.js';
import { ListApiKeysUseCase } from '../../application/use-cases/list-api-keys.use-case.js';
import { RevokeApiKeyUseCase } from '../../application/use-cases/revoke-api-key.use-case.js';
import { RotateApiKeyUseCase } from '../../application/use-cases/rotate-api-key.use-case.js';
import { apiKeysPermissions } from '../../permissions.js';
import { ApiKeyResponseDto } from './dtos/api-key-response.dto.js';
import { CreateApiKeyRequestDto } from './dtos/create-api-key.request.dto.js';
import { CreatedApiKeyResponseDto } from './dtos/created-api-key-response.dto.js';
import { ListApiKeysQueryDto } from './dtos/list-api-keys.query.dto.js';

/**
 * API keys. The guard accepts any of `apikeys:self` / `apikeys:read` /
 * `apikeys:manage`; the controller then narrows per operation: your own keys
 * need `self`, other users' keys need `read` (list) or `manage` (mutate).
 */
@ApiTags('apikeys')
@Controller('apikeys')
export class ApiKeysController {
  constructor(
    private readonly listApiKeys: ListApiKeysUseCase,
    private readonly getApiKey: GetApiKeyUseCase,
    private readonly createApiKey: CreateApiKeyUseCase,
    private readonly rotateApiKey: RotateApiKeyUseCase,
    private readonly revokeApiKey: RevokeApiKeyUseCase,
  ) {}

  @Get()
  @RequireAnyPermissions(apiKeysPermissions.self, apiKeysPermissions.read)
  @ApiOperation({ summary: 'List API keys (own, of one user, or all)' })
  @ApiOkResponse({ type: [ApiKeyResponseDto] })
  @ApiForbiddenResponse({ description: 'Listing another user\u2019s keys requires `apikeys:read`.' })
  async findAll(
    @Query() query: ListApiKeysQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ApiKeyResponseDto[]> {
    const principal = this.principalOf(request);
    const wantsAll = query.all === 'true';
    const targetsAnotherUser = query.userId !== undefined && query.userId !== principal.userId;

    if ((wantsAll || targetsAnotherUser) && !principal.permissions.has(apiKeysPermissions.read)) {
      throw new PermissionDeniedError([apiKeysPermissions.read]);
    }

    const keys = await this.listApiKeys.execute({
      requesterId: principal.userId,
      userId: query.userId,
      all: wantsAll,
    });

    return keys.map((apiKey) => ApiKeyResponseDto.fromDomain(apiKey));
  }

  @Post()
  @RequireAnyPermissions(apiKeysPermissions.self, apiKeysPermissions.manage)
  @ApiOperation({ summary: 'Create an API key (own, or on behalf of a user)' })
  @ApiCreatedResponse({
    type: CreatedApiKeyResponseDto,
    description: 'The plain key is included exactly once.',
  })
  @ApiBadRequestResponse({ description: 'Invalid name, expiration or scopes.' })
  @ApiConflictResponse({ description: 'The owner reached the configured limit of active keys.' })
  @ApiForbiddenResponse({ description: 'Creating for another user requires `apikeys:manage`.' })
  @ApiNotFoundResponse({ description: 'The target user does not exist.' })
  async create(
    @Body() body: CreateApiKeyRequestDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<CreatedApiKeyResponseDto> {
    const principal = this.principalOf(request);

    if (
      body.userId !== undefined &&
      body.userId !== principal.userId &&
      !principal.permissions.has(apiKeysPermissions.manage)
    ) {
      throw new PermissionDeniedError([apiKeysPermissions.manage]);
    }

    const { apiKey, secret } = await this.createApiKey.execute({
      requesterId: principal.userId,
      userId: body.userId,
      name: body.name,
      scopes: body.scopes,
      expiresInDays: body.expiresInDays,
    });

    return CreatedApiKeyResponseDto.fromDomainWithSecret(apiKey, secret);
  }

  @Post(':id/rotate')
  @RequireAnyPermissions(apiKeysPermissions.self, apiKeysPermissions.manage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the secret of a key, keeping its scopes' })
  @ApiOkResponse({
    type: CreatedApiKeyResponseDto,
    description: 'The new plain key is included exactly once.',
  })
  @ApiConflictResponse({ description: 'The key is revoked.' })
  @ApiNotFoundResponse({ description: 'No key with this id exists.' })
  async rotate(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<CreatedApiKeyResponseDto> {
    await this.ensureCanMutate(id, this.principalOf(request));

    const { apiKey, secret } = await this.rotateApiKey.execute({ id });

    return CreatedApiKeyResponseDto.fromDomainWithSecret(apiKey, secret);
  }

  @Delete(':id')
  @RequireAnyPermissions(apiKeysPermissions.self, apiKeysPermissions.manage)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a key; it never authenticates again' })
  @ApiNoContentResponse({ description: 'The key was revoked.' })
  @ApiConflictResponse({ description: 'The key is already revoked.' })
  @ApiNotFoundResponse({ description: 'No key with this id exists.' })
  async remove(@Param('id') id: string, @Req() request: AuthenticatedRequest): Promise<void> {
    await this.ensureCanMutate(id, this.principalOf(request));
    await this.revokeApiKey.execute({ id });
  }

  /** Your own keys need `self`; someone else's need `manage`. */
  private async ensureCanMutate(id: string, principal: Principal): Promise<void> {
    const apiKey = await this.getApiKey.execute({ id });

    if (
      apiKey.userId !== principal.userId &&
      !principal.permissions.has(apiKeysPermissions.manage)
    ) {
      throw new PermissionDeniedError([apiKeysPermissions.manage]);
    }
  }

  private principalOf(request: AuthenticatedRequest): Principal {
    const principal = request.user;

    // Defensive: only reachable if the guards run out of order.
    if (principal === undefined) {
      throw new AuthenticationRequiredError();
    }

    return principal;
  }
}

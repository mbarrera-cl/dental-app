import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentPrincipal } from '../../../../shared/security/current-principal.decorator.js';
import type { Principal } from '../../../../shared/security/principal.js';
import { RequirePermissions } from '../../../../shared/security/require-permissions.decorator.js';
import { CreateUcoProcedureUseCase } from '../../application/use-cases/create-uco-procedure.use-case.js';
import { DeleteUcoProcedureUseCase } from '../../application/use-cases/delete-uco-procedure.use-case.js';
import { GetUcoProcedureUseCase } from '../../application/use-cases/get-uco-procedure.use-case.js';
import { ListUcoProceduresUseCase } from '../../application/use-cases/list-uco-procedures.use-case.js';
import { UpdateUcoProcedureUseCase } from '../../application/use-cases/update-uco-procedure.use-case.js';
import { ucoPermissions } from '../../permissions.js';
import { CreateUcoProcedureRequestDto, UpdateUcoProcedureRequestDto } from './dtos/uco-procedure.request.dto.js';
import { UcoProcedureResponseDto } from './dtos/uco-procedure.response.dto.js';

/**
 * Driving adapter for the UCO fee catalog. It contains no business logic —
 * validation lives in the domain (`UcoProcedure`) and the request DTOs.
 */
@ApiTags('uco')
@Controller('uco')
export class UcoController {
  constructor(
    private readonly list: ListUcoProceduresUseCase,
    private readonly get: GetUcoProcedureUseCase,
    private readonly create: CreateUcoProcedureUseCase,
    private readonly update: UpdateUcoProcedureUseCase,
    private readonly remove: DeleteUcoProcedureUseCase,
  ) {}

  @Get()
  @RequirePermissions(ucoPermissions.read)
  @ApiOperation({ summary: 'List/search the UCO fee catalog' })
  @ApiQuery({ name: 'q', required: false, description: 'Search term (code, name or chapter)' })
  @ApiQuery({ name: 'active', required: false, description: 'Only active entries when `true`' })
  @ApiOkResponse({ type: [UcoProcedureResponseDto] })
  async findAll(
    @Query('q') q?: string,
    @Query('active') active?: string,
  ): Promise<UcoProcedureResponseDto[]> {
    const procedures = await this.list.execute({
      q,
      active: active === undefined ? undefined : active === 'true',
    });

    return procedures.map((procedure) => UcoProcedureResponseDto.fromDomain(procedure));
  }

  @Get(':id')
  @RequirePermissions(ucoPermissions.read)
  @ApiOperation({ summary: 'Get one UCO procedure by id' })
  @ApiOkResponse({ type: UcoProcedureResponseDto })
  @ApiNotFoundResponse({ description: 'No procedure with this id exists.' })
  async findOne(@Param('id') id: string): Promise<UcoProcedureResponseDto> {
    const procedure = await this.get.execute({ id });

    return UcoProcedureResponseDto.fromDomain(procedure);
  }

  @Post()
  @RequirePermissions(ucoPermissions.manage)
  @ApiOperation({ summary: 'Create a UCO procedure' })
  @ApiCreatedResponse({ type: UcoProcedureResponseDto })
  @ApiBadRequestResponse({ description: 'The payload failed validation.' })
  @ApiConflictResponse({ description: 'The code already exists.' })
  async createOne(
    @Body() body: CreateUcoProcedureRequestDto,
    @CurrentPrincipal() principal: Principal,
  ): Promise<UcoProcedureResponseDto> {
    const procedure = await this.create.execute({
      code: body.code,
      chapter: body.chapter,
      name: body.name,
      units: body.units,
      actorId: principal.userId,
    });

    return UcoProcedureResponseDto.fromDomain(procedure);
  }

  @Patch(':id')
  @RequirePermissions(ucoPermissions.manage)
  @ApiOperation({ summary: 'Update a UCO procedure (partial, includes the soft-delete toggle)' })
  @ApiOkResponse({ type: UcoProcedureResponseDto })
  @ApiBadRequestResponse({ description: 'The payload failed validation.' })
  @ApiNotFoundResponse({ description: 'No procedure with this id exists.' })
  @ApiConflictResponse({ description: 'The new code is already taken.' })
  async updateOne(
    @Param('id') id: string,
    @Body() body: UpdateUcoProcedureRequestDto,
    @CurrentPrincipal() principal: Principal,
  ): Promise<UcoProcedureResponseDto> {
    const result = await this.update.execute({
      id,
      code: body.code,
      chapter: body.chapter,
      name: body.name,
      units: body.units,
      active: body.active,
      actorId: principal.userId,
    });

    return UcoProcedureResponseDto.fromDomain(result.procedure);
  }

  @Delete(':id')
  @RequirePermissions(ucoPermissions.manage)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a UCO procedure' })
  @ApiNoContentResponse({ description: 'The procedure was deactivated.' })
  @ApiNotFoundResponse({ description: 'No procedure with this id exists.' })
  async removeOne(@Param('id') id: string): Promise<void> {
    await this.remove.execute({ id });
  }
}

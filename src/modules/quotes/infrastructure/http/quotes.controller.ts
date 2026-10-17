import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query } from '@nestjs/common';
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
import { CreateQuoteUseCase } from '../../application/use-cases/create-quote.use-case.js';
import { DecideQuoteItemUseCase } from '../../application/use-cases/decide-quote-item.use-case.js';
import { DeleteQuoteUseCase } from '../../application/use-cases/delete-quote.use-case.js';
import { DuplicateQuoteUseCase } from '../../application/use-cases/duplicate-quote.use-case.js';
import { GetQuoteUseCase } from '../../application/use-cases/get-quote.use-case.js';
import { ListQuoteVersionsUseCase, type QuoteVersion } from '../../application/use-cases/list-quote-versions.use-case.js';
import { ListQuotesUseCase } from '../../application/use-cases/list-quotes.use-case.js';
import { RestoreQuoteUseCase } from '../../application/use-cases/restore-quote.use-case.js';
import { SanctionQuoteUseCase } from '../../application/use-cases/sanction-quote.use-case.js';
import { UpdateQuoteUseCase } from '../../application/use-cases/update-quote.use-case.js';
import { quotesPermissions } from '../../permissions.js';
import {
  CreateQuoteRequestDto,
  DecideQuoteItemRequestDto,
  SanctionQuoteRequestDto,
  UpdateQuoteRequestDto,
} from './dtos/quote.request.dto.js';
import { QuoteResponseDto } from './dtos/quote.response.dto.js';

/**
 * Driving adapter for quotations. Translates HTTP requests into use cases;
 * no business logic here. Totals are recomputed server-side on every save.
 */
@ApiTags('quotes')
@Controller('quotes')
export class QuotesController {
  constructor(
    private readonly list: ListQuotesUseCase,
    private readonly get: GetQuoteUseCase,
    private readonly create: CreateQuoteUseCase,
    private readonly update: UpdateQuoteUseCase,
    private readonly remove: DeleteQuoteUseCase,
    private readonly decideItem: DecideQuoteItemUseCase,
    private readonly sanction: SanctionQuoteUseCase,
    private readonly restore: RestoreQuoteUseCase,
    private readonly duplicate: DuplicateQuoteUseCase,
    private readonly versions: ListQuoteVersionsUseCase,
  ) {}

  @Get()
  @RequirePermissions(quotesPermissions.read)
  @ApiOperation({ summary: 'List quotations (filters: patient, status, folio, date range)' })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'deleted', required: false, enum: ['exclude', 'only', 'all'] })
  @ApiOkResponse({ type: [QuoteResponseDto] })
  async findAll(
    @Query('patientId') patientId?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('deleted') deleted?: string,
  ): Promise<QuoteResponseDto[]> {
    const quotes = await this.list.execute({
      patientId,
      status,
      q,
      from,
      to,
      deleted: deleted === 'only' || deleted === 'all' ? deleted : 'exclude',
    });

    return quotes.map((quote) => QuoteResponseDto.fromDomain(quote));
  }

  @Get(':id')
  @RequirePermissions(quotesPermissions.read)
  @ApiOperation({ summary: 'Get one quotation by id' })
  @ApiOkResponse({ type: QuoteResponseDto })
  @ApiNotFoundResponse({ description: 'No quote with this id exists.' })
  async findOne(@Param('id') id: string): Promise<QuoteResponseDto> {
    const quote = await this.get.execute({ id });

    return QuoteResponseDto.fromDomain(quote);
  }

  @Post()
  @RequirePermissions(quotesPermissions.create)
  @ApiOperation({ summary: 'Create a draft quotation' })
  @ApiCreatedResponse({ type: QuoteResponseDto })
  @ApiBadRequestResponse({ description: 'The payload failed validation.' })
  @ApiNotFoundResponse({ description: 'No patient with this id exists.' })
  async createOne(
    @Body() body: CreateQuoteRequestDto,
    @CurrentPrincipal() principal: Principal,
  ): Promise<QuoteResponseDto> {
    const quote = await this.create.execute({
      patientId: body.patientId,
      validUntil: body.validUntil,
      notes: body.notes,
      items: body.items,
      actorId: principal.userId,
      actorName: principal.name,
    });

    return QuoteResponseDto.fromDomain(quote);
  }

  @Put(':id')
  @RequirePermissions(quotesPermissions.update)
  @ApiOperation({ summary: 'Save the current state of a draft/entregada quote' })
  @ApiOkResponse({ type: QuoteResponseDto })
  @ApiBadRequestResponse({ description: 'The payload failed validation.' })
  @ApiNotFoundResponse({ description: 'No quote with this id exists.' })
  @ApiConflictResponse({ description: 'The quote is sanctioned and locked.' })
  async updateOne(
    @Param('id') id: string,
    @Body() body: UpdateQuoteRequestDto,
    @CurrentPrincipal() principal: Principal,
  ): Promise<QuoteResponseDto> {
    const quote = await this.update.execute({
      id,
      validUntil: body.validUntil,
      notes: body.notes,
      items: body.items,
      actorId: principal.userId,
      actorName: principal.name,
    });

    return QuoteResponseDto.fromDomain(quote);
  }

  @Delete(':id')
  @RequirePermissions(quotesPermissions.delete)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Move a quotation to the trash (soft delete, any status)',
  })
  @ApiNoContentResponse({ description: 'The quotation is now in the trash.' })
  @ApiNotFoundResponse({ description: 'No quote with this id exists.' })
  async removeOne(
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<void> {
    await this.remove.execute({ id, actorId: principal.userId, actorName: principal.name });
  }

  @Post(':id/restore')
  @RequirePermissions(quotesPermissions.delete)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore a quotation from the trash' })
  @ApiOkResponse({ type: QuoteResponseDto })
  @ApiNotFoundResponse({ description: 'No quote with this id exists.' })
  async restoreOne(
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<QuoteResponseDto> {
    const quote = await this.restore.execute({
      id,
      actorId: principal.userId,
      actorName: principal.name,
    });

    return QuoteResponseDto.fromDomain(quote);
  }

  @Post(':id/duplicate')
  @RequirePermissions(quotesPermissions.create)
  @ApiOperation({ summary: 'Duplicate a quotation as a new draft version' })
  @ApiCreatedResponse({ type: QuoteResponseDto })
  @ApiNotFoundResponse({ description: 'No quote with this id exists.' })
  async duplicateOne(
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<QuoteResponseDto> {
    const quote = await this.duplicate.execute({
      id,
      actorId: principal.userId,
      actorName: principal.name,
    });

    return QuoteResponseDto.fromDomain(quote);
  }

  @Patch(':id/items/:itemId/status')
  @RequirePermissions(quotesPermissions.update)
  @ApiOperation({ summary: 'Decide the acceptance state of one line' })
  @ApiOkResponse({ type: QuoteResponseDto })
  @ApiNotFoundResponse({ description: 'Quote or item not found.' })
  @ApiConflictResponse({ description: 'The quote is sanctioned and locked.' })
  async decideItemOf(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: DecideQuoteItemRequestDto,
    @CurrentPrincipal() principal: Principal,
  ): Promise<QuoteResponseDto> {
    const quote = await this.decideItem.execute({
      quoteId: id,
      itemId,
      status: body.status,
      actorId: principal.userId,
      actorName: principal.name,
    });

    return QuoteResponseDto.fromDomain(quote);
  }

  @Patch(':id/status')
  @RequirePermissions(quotesPermissions.approve)
  @ApiOperation({ summary: 'Sanction (approve/reject) a quotation' })
  @ApiOkResponse({ type: QuoteResponseDto })
  @ApiNotFoundResponse({ description: 'No quote with this id exists.' })
  @ApiConflictResponse({ description: 'The quote is already sanctioned.' })
  async sanctionOne(
    @Param('id') id: string,
    @Body() body: SanctionQuoteRequestDto,
    @CurrentPrincipal() principal: Principal,
  ): Promise<QuoteResponseDto> {
    const quote = await this.sanction.execute({
      id,
      status: body.status,
      actorId: principal.userId,
      actorName: principal.name,
    });

    return QuoteResponseDto.fromDomain(quote);
  }

  @Get(':id/versions')
  @RequirePermissions(quotesPermissions.read)
  @ApiOperation({ summary: 'Version trail of a quotation (oldest first)' })
  @ApiOkResponse({ type: [QuoteResponseDto] })
  @ApiNotFoundResponse({ description: 'No quote with this id exists.' })
  async versionsOf(@Param('id') id: string): Promise<QuoteVersion[]> {
    return this.versions.execute({ quoteId: id });
  }
}

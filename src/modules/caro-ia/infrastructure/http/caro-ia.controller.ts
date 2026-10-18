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
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ActivitySkip } from '../../../activity/infrastructure/http/activity-action.decorator.js';
import { CurrentPrincipal } from '../../../../shared/security/current-principal.decorator.js';
import type { AuthenticatedRequest } from '../../../../shared/security/authenticated-request.js';
import type { Principal } from '../../../../shared/security/principal.js';
import { RequirePermissions } from '../../../../shared/security/require-permissions.decorator.js';
import { CaroIaService } from '../../application/caro-ia.service.js';
import type { CaroStreamEvent } from '../../domain/caro-ia.models.js';
import { caroIaPermissions } from '../../permissions.js';
import {
  CreateCaroConversationRequestDto,
  DecideCaroApprovalRequestDto,
  RenameCaroConversationRequestDto,
  SendCaroMessageRequestDto,
} from './dtos/caro-ia.request.dto.js';

@ApiTags('caro-ia')
@Controller('caro-ia')
@RequirePermissions(caroIaPermissions.use)
export class CaroIaController {
  constructor(private readonly service: CaroIaService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'List the current user conversations (newest first)' })
  @ApiOkResponse()
  async list(@CurrentPrincipal() principal: Principal) {
    return this.service.list(principal.userId);
  }

  @Post('conversations')
  @ApiOperation({ summary: 'Create an empty conversation (the UI creates it on first send)' })
  @ApiCreatedResponse()
  async create(
    @Body() body: CreateCaroConversationRequestDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.create(principal.userId, body.title);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get one conversation with its messages and approvals' })
  @ApiOkResponse()
  async get(@Param('id') id: string, @CurrentPrincipal() principal: Principal) {
    return this.service.get(principal.userId, id);
  }

  @Patch('conversations/:id')
  @ApiOperation({ summary: 'Rename a conversation' })
  @ApiOkResponse()
  async rename(
    @Param('id') id: string,
    @Body() body: RenameCaroConversationRequestDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.rename(principal.userId, id, body.title);
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a conversation' })
  @ApiNoContentResponse()
  async remove(@Param('id') id: string, @CurrentPrincipal() principal: Principal) {
    await this.service.remove(principal.userId, id);
  }

  @Post('conversations/:id/messages')
  @ActivitySkip()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a text message and stream the assistant turn (SSE)' })
  @ApiBadRequestResponse()
  async send(
    @Param('id') conversationId: string,
    @Body() body: SendCaroMessageRequestDto,
    @CurrentPrincipal() principal: Principal,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ): Promise<void> {
    const prepared = await this.service.prepareSend(
      principal,
      conversationId,
      body.content,
      body.attachmentIds ?? [],
    );

    await this.stream(req, res, this.service.streamReply(principal, prepared, reqAbort(req)));
  }

  @Post('conversations/:id/approvals/:approvalId')
  @ActivitySkip()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve or reject a pending write and stream the result (SSE)' })
  async decideApproval(
    @Param('id') conversationId: string,
    @Param('approvalId') approvalId: string,
    @Body() body: DecideCaroApprovalRequestDto,
    @CurrentPrincipal() principal: Principal,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ): Promise<void> {
    const prepared = await this.service.prepareDecision(
      principal,
      conversationId,
      approvalId,
      body.decision,
    );

    await this.stream(
      req,
      res,
      this.service.streamDecision(principal, prepared, reqAbort(req)),
    );
  }

  @Post('transcribe')
  @ActivitySkip()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 26_214_400 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Transcribe a short audio recording with Deepgram (not persisted)' })
  async transcribe(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.transcribe(principal, file);
  }

  private async stream(
    req: AuthenticatedRequest,
    res: Response,
    events: AsyncGenerator<CaroStreamEvent>,
  ): Promise<void> {
    res.status(HttpStatus.OK);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const controller = new AbortController();
    const onClose = (): void => controller.abort();
    req.on('close', onClose);

    try {
      for await (const event of events) {
        if (controller.signal.aborted) {
          break;
        }

        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        const message =
          error instanceof Error ? error.message : 'CaroIA could not complete the response';

        res.write(
          `data: ${JSON.stringify({ type: 'error', message: safeSseMessage(message) })}\n\n`,
        );
      }
    } finally {
      req.off('close', onClose);
      res.end();
    }
  }
}

function reqAbort(req: AuthenticatedRequest): AbortSignal {
  const controller = new AbortController();
  req.on('close', () => controller.abort());

  return controller.signal;
}

function safeSseMessage(message: string): string {
  return message.length <= 240 ? message : `${message.slice(0, 239)}…`;
}

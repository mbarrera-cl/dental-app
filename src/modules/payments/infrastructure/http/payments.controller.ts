import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentPrincipal } from '../../../../shared/security/current-principal.decorator.js';
import type { Principal } from '../../../../shared/security/principal.js';
import { RequirePermissions } from '../../../../shared/security/require-permissions.decorator.js';
import { ActivityAction } from '../../../activity/infrastructure/http/activity-action.decorator.js';
import {
  GetCashSummaryUseCase,
  type CashSummaryEntry,
} from '../../application/use-cases/get-cash-summary.use-case.js';
import { GetMovementUseCase } from '../../application/use-cases/get-movement.use-case.js';
import { GetPatientBalanceUseCase } from '../../application/use-cases/get-patient-balance.use-case.js';
import { ListMovementsUseCase } from '../../application/use-cases/list-movements.use-case.js';
import { RecordChargeUseCase } from '../../application/use-cases/record-charge.use-case.js';
import { RecordPaymentUseCase } from '../../application/use-cases/record-payment.use-case.js';
import { VoidMovementUseCase } from '../../application/use-cases/void-movement.use-case.js';
import { paymentsPermissions } from '../../permissions.js';
import { CashSummaryEntryDto, LedgerResponseDto } from './dtos/ledger.response.dto.js';
import { MovementResponseDto } from './dtos/movement.response.dto.js';
import { RecordChargeRequestDto } from './dtos/record-charge.request.dto.js';
import { RecordPaymentRequestDto } from './dtos/record-payment.request.dto.js';
import { VoidMovementRequestDto } from './dtos/void-movement.request.dto.js';

/**
 * Driving adapter for the patient account (cobros / caja). The ledger is
 * append-only: charges and payments are recorded, mistakes are annulled —
 * nothing is edited or deleted.
 */
@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(
    private readonly recordCharge: RecordChargeUseCase,
    private readonly recordPayment: RecordPaymentUseCase,
    private readonly listMovements: ListMovementsUseCase,
    private readonly patientBalance: GetPatientBalanceUseCase,
    private readonly voidMovement: VoidMovementUseCase,
    private readonly cashSummary: GetCashSummaryUseCase,
    private readonly getMovement: GetMovementUseCase,
  ) {}

  @Post('patients/:patientId/ledger/charges')
  @RequirePermissions(paymentsPermissions.create)
  @ActivityAction({
    action: 'payments.charge.record',
    subjectType: 'patient',
    subjectParam: 'patientId',
  })
  @ApiOperation({ summary: 'Record a charge (cargo) on the patient account' })
  @ApiCreatedResponse({ type: MovementResponseDto })
  @ApiBadRequestResponse({ description: 'The payload failed validation.' })
  @ApiNotFoundResponse({ description: 'No patient with this id exists.' })
  async recordChargeOn(
    @Param('patientId') patientId: string,
    @Body() body: RecordChargeRequestDto,
    @CurrentPrincipal() principal: Principal,
  ): Promise<MovementResponseDto> {
    const movement = await this.recordCharge.execute({
      patientId,
      amount: body.amount,
      concept: body.concept,
      quoteId: body.quoteId ?? null,
      appointmentId: body.appointmentId ?? null,
      actorId: principal.userId,
    });

    return MovementResponseDto.fromDomain(movement);
  }

  @Post('patients/:patientId/ledger/payments')
  @RequirePermissions(paymentsPermissions.create)
  @ActivityAction({
    action: 'payments.payment.record',
    subjectType: 'patient',
    subjectParam: 'patientId',
  })
  @ApiOperation({ summary: 'Record a payment (abono) on the patient account' })
  @ApiCreatedResponse({ type: MovementResponseDto })
  @ApiBadRequestResponse({ description: 'The payload failed validation.' })
  @ApiNotFoundResponse({ description: 'No patient with this id exists.' })
  async recordPaymentOn(
    @Param('patientId') patientId: string,
    @Body() body: RecordPaymentRequestDto,
    @CurrentPrincipal() principal: Principal,
  ): Promise<MovementResponseDto> {
    const movement = await this.recordPayment.execute({
      patientId,
      amount: body.amount,
      concept: body.concept,
      method: body.method,
      reference: body.reference ?? null,
      quoteId: body.quoteId ?? null,
      appointmentId: body.appointmentId ?? null,
      actorId: principal.userId,
    });

    return MovementResponseDto.fromDomain(movement);
  }

  @Get('patients/:patientId/ledger')
  @RequirePermissions(paymentsPermissions.read)
  @ApiOperation({ summary: 'History of the patient account plus its computed balance' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiOkResponse({ type: LedgerResponseDto })
  @ApiNotFoundResponse({ description: 'No patient with this id exists.' })
  async ledgerOf(
    @Param('patientId') patientId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<LedgerResponseDto> {
    const [page, balance] = await Promise.all([
      this.listMovements.execute({
        patientId,
        limit: parseInteger(limit, ListMovementsUseCase.DEFAULT_LIMIT),
        offset: parseInteger(offset, 0),
      }),
      this.patientBalance.execute({ patientId }),
    ]);

    return LedgerResponseDto.fromDomain(balance, page);
  }

  @Post('ledger/:id/void')
  @RequirePermissions(paymentsPermissions.void)
  @HttpCode(HttpStatus.OK)
  @ActivityAction({
    action: 'payments.movement.void',
    subjectType: 'movement',
    subjectParam: 'id',
  })
  @ApiOperation({ summary: 'Annul a ledger movement (the row stays, the balance heals)' })
  @ApiOkResponse({ type: MovementResponseDto })
  @ApiNotFoundResponse({ description: 'No movement with this id exists.' })
  @ApiConflictResponse({ description: 'The movement was already voided.' })
  async voidOne(
    @Param('id') id: string,
    @Body() body: VoidMovementRequestDto,
    @CurrentPrincipal() principal: Principal,
  ): Promise<MovementResponseDto> {
    const movement = await this.voidMovement.execute({
      id,
      reason: body.reason,
      actorId: principal.userId,
    });

    return MovementResponseDto.fromDomain(movement);
  }

  @Get('ledger/cash-summary')
  @RequirePermissions(paymentsPermissions.read)
  @ApiOperation({
    summary: 'Close-of-day: non-voided payments grouped by method in an inclusive range',
  })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiOkResponse({ type: [CashSummaryEntryDto] })
  async summary(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<CashSummaryEntry[]> {
    return this.cashSummary.execute({ from: from ?? null, to: to ?? null });
  }

  @Get('ledger/:id')
  @RequirePermissions(paymentsPermissions.read)
  @ApiOperation({ summary: 'Get one ledger movement by id (receipt printing reads this)' })
  @ApiOkResponse({ type: MovementResponseDto })
  @ApiNotFoundResponse({ description: 'No movement with this id exists.' })
  async findOne(@Param('id') id: string): Promise<MovementResponseDto> {
    const movement = await this.getMovement.execute({ id });

    return MovementResponseDto.fromDomain(movement);
  }
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) ? parsed : fallback;
}

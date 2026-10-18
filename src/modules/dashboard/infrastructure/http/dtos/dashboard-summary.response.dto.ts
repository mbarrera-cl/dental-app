import { ApiProperty } from '@nestjs/swagger';
import type {
  ActivitySummary,
  DashboardSummary,
  DebtorSummary,
  MethodTotal,
  PrevisionCount,
  QuoteStatusKey,
  StatusCount,
  UpcomingAppointment,
} from '../../../domain/dashboard-summary.js';

export interface DashboardWindowResponse {
  /** ISO instant of the start of the current day. */
  today: string;
  /** ISO instant of the start of the current calendar month. */
  monthStart: string;
}

export interface PatientsBlockResponse {
  total: number;
  newLast30Days: number;
  prevision: PrevisionCount[];
}

export interface CashBlockResponse {
  outstanding: number;
  chargesMonth: number;
  collectionsToday: MethodTotal[];
  collectionsMonth: MethodTotal[];
  topDebtors: DebtorSummary[];
}

export interface QuotesBlockResponse {
  funnel: Record<QuoteStatusKey, number>;
  approvedMonth: number;
  conversionRate: number | null;
  expiringSoon: number;
}

export interface AgendaBlockResponse {
  today: StatusCount[];
  cancelledMonth: number;
  totalMonth: number;
  next: Array<Omit<UpcomingAppointment, 'startsAt'> & { startsAt: string }>;
}

/** Outbound dashboard read model. Dates are ISO strings on the wire. */
export class DashboardSummaryResponseDto {
  @ApiProperty({
    description: 'Time window shared by every block',
    example: { today: '2026-10-18T04:00:00.000Z', monthStart: '2026-10-01T03:00:00.000Z' },
  })
  window: DashboardWindowResponse;

  @ApiProperty()
  patients: PatientsBlockResponse;

  @ApiProperty()
  cash: CashBlockResponse;

  @ApiProperty()
  quotes: QuotesBlockResponse;

  @ApiProperty()
  agenda: AgendaBlockResponse;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  recentActivity: Array<Omit<ActivitySummary, 'at'> & { at: string }>;

  static fromDomain(summary: DashboardSummary): DashboardSummaryResponseDto {
    const dto = new DashboardSummaryResponseDto();
    dto.window = {
      today: summary.window.today.toISOString(),
      monthStart: summary.window.monthStart.toISOString(),
    };
    dto.patients = summary.patients;
    dto.cash = summary.cash;
    dto.quotes = summary.quotes;
    dto.agenda = {
      ...summary.agenda,
      next: summary.agenda.next.map((appointment) => ({
        ...appointment,
        startsAt: appointment.startsAt.toISOString(),
      })),
    };
    dto.recentActivity = summary.recentActivity.map((entry) => ({
      ...entry,
      at: entry.at.toISOString(),
    }));
    return dto;
  }
}

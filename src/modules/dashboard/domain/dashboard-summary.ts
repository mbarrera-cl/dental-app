import type { PaymentMethod } from '../../payments/domain/payment-method.js';

/** Inclusive/exclusive bounds used by every aggregate of one dashboard read. */
export interface DashboardWindow {
  /** Start of the current day (server local time). */
  today: Date;
  /** Start of the next day (exclusive upper bound). */
  tomorrow: Date;
  /** Start of the current calendar month. */
  monthStart: Date;
  /** Start of the next calendar month (exclusive upper bound). */
  nextMonthStart: Date;
  /** Start of the current day minus 30 days (new patients window). */
  thirtyDaysAgo: Date;
  /** `now + 7 days` (quotes about to expire). */
  inSevenDays: Date;
}

export type QuoteStatusKey = 'borrador' | 'sin_respuesta' | 'aprobada' | 'rechazada';

export type PrevisionTipo = 'FONASA' | 'ISAPRE' | 'CONVENIO' | 'PARTICULAR';

export interface PrevisionCount {
  tipo: PrevisionTipo;
  count: number;
}

export interface MethodTotal {
  method: PaymentMethod;
  total: number;
}

export interface DebtorSummary {
  patientId: string;
  patientName: string;
  /** Non-voided cargos minus abonos; always > 0 in this list. */
  balance: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface UpcomingAppointment {
  id: string;
  startsAt: Date;
  patientName: string;
  professionalName: string;
  reason: string | null;
}

export interface ActivitySummary {
  at: Date;
  actor: string | null;
  action: string;
  module: string;
  subject: string | null;
  outcome: string;
}

/**
 * One read-model snapshot for the dashboard. Computed from the source modules
 * on every request (no materialized tables): the same figures the clinic sees
 * in patients, quotes, agenda, cash and activity, aggregated server-side so
 * every card shares one time window.
 */
export interface DashboardSummary {
  window: {
    today: Date;
    monthStart: Date;
  };
  patients: {
    total: number;
    newLast30Days: number;
    prevision: PrevisionCount[];
  };
  cash: {
    /** Appendix-only ledger: Σ non-voided cargos − Σ non-voided abonos. */
    outstanding: number;
    chargesMonth: number;
    collectionsToday: MethodTotal[];
    collectionsMonth: MethodTotal[];
    topDebtors: DebtorSummary[];
  };
  quotes: {
    funnel: Record<QuoteStatusKey, number>;
    approvedMonth: number;
    /** Approved / decided quotes sanctioned inside the month; null when none. */
    conversionRate: number | null;
    /** Quotes awaiting response that expire within the next 7 days. */
    expiringSoon: number;
  };
  agenda: {
    today: StatusCount[];
    cancelledMonth: number;
    totalMonth: number;
    next: UpcomingAppointment[];
  };
  recentActivity: ActivitySummary[];
}

/** Builds the bounds of one dashboard read from a reference instant. */
export function dashboardWindow(now: Date): DashboardWindow {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const inSevenDays = new Date(today);
  inSevenDays.setDate(inSevenDays.getDate() + 7);

  return { today, tomorrow, monthStart, nextMonthStart, thirtyDaysAgo, inSevenDays };
}

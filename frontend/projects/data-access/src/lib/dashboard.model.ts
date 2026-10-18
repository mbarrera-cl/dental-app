import type { PaymentMethod } from './payment.model';
import type { PrevisionTipo } from './patient.model';

export type { PrevisionTipo };

export type QuoteStatusKey = 'borrador' | 'sin_respuesta' | 'aprobada' | 'rechazada';

/** `GET /dashboard/summary` — one snapshot shared by every dashboard card. */
export interface DashboardSummary {
  /** ISO instants of the day and calendar-month bounds used by every block. */
  window: {
    today: string;
    monthStart: string;
  };
  patients: {
    total: number;
    newLast30Days: number;
    prevision: Array<{ tipo: PrevisionTipo; count: number }>;
  };
  cash: {
    /** Σ non-voided cargos − Σ non-voided abonos, all patients. */
    outstanding: number;
    chargesMonth: number;
    collectionsToday: Array<{ method: PaymentMethod; total: number }>;
    collectionsMonth: Array<{ method: PaymentMethod; total: number }>;
    topDebtors: Array<{ patientId: string; patientName: string; balance: number }>;
  };
  quotes: {
    funnel: Record<QuoteStatusKey, number>;
    approvedMonth: number;
    /** Approved / decided quotes sanctioned this month; null when none. */
    conversionRate: number | null;
    /** Quotes awaiting response that expire within the next 7 days. */
    expiringSoon: number;
  };
  agenda: {
    today: Array<{ status: string; count: number }>;
    cancelledMonth: number;
    totalMonth: number;
    next: Array<{
      id: string;
      startsAt: string;
      patientName: string;
      professionalName: string;
      reason: string | null;
    }>;
  };
  recentActivity: Array<{
    at: string;
    actor: string | null;
    action: string;
    module: string;
    subject: string | null;
    outcome: string;
  }>;
}

import type { PaymentMethod } from '../../../../payments/domain/payment-method.js';
import type {
  ActivitySummary,
  DashboardSummary,
  DashboardWindow,
  MethodTotal,
  PrevisionTipo,
  QuoteStatusKey,
} from '../../../domain/dashboard-summary.js';
import { DashboardQueryPort } from '../../../application/ports/dashboard-query.port.js';

export interface SeededPatient {
  id: string;
  name: string;
  createdAt: Date;
  previsionTipo: PrevisionTipo | null;
}

export interface SeededLedgerEntry {
  patientId: string;
  kind: 'cargo' | 'abono';
  amount: number;
  method: PaymentMethod | null;
  createdAt: Date;
  voidedAt: Date | null;
}

export interface SeededQuote {
  id: string;
  status: QuoteStatusKey;
  sanctionedAt: Date | null;
  validUntil: Date | null;
  deletedAt: Date | null;
  /** Sum of its approved items, as the quote entity computes it. */
  approvedTotal: number;
}

export interface SeededAppointment {
  id: string;
  startsAt: Date;
  status: string;
  patientName: string;
  professionalName: string;
  reason: string | null;
}

export interface DashboardSeed {
  patients?: SeededPatient[];
  ledger?: SeededLedgerEntry[];
  quotes?: SeededQuote[];
  appointments?: SeededAppointment[];
  activity?: ActivitySummary[];
}

const METHODS: PaymentMethod[] = ['efectivo', 'tarjeta', 'transferencia'];
const PREVISION: PrevisionTipo[] = ['FONASA', 'ISAPRE', 'CONVENIO', 'PARTICULAR'];

/** Deterministic in-memory twin of the SQL read model (specs and previews). */
export class InMemoryDashboardQuery implements DashboardQueryPort {
  private readonly patients: SeededPatient[];
  private readonly ledger: SeededLedgerEntry[];
  private readonly quotes: SeededQuote[];
  private readonly appointments: SeededAppointment[];
  private readonly activity: ActivitySummary[];

  constructor(seed: DashboardSeed = {}) {
    this.patients = seed.patients ?? [];
    this.ledger = seed.ledger ?? [];
    this.quotes = seed.quotes ?? [];
    this.appointments = seed.appointments ?? [];
    this.activity = seed.activity ?? [];
  }

  async getSummary(window: DashboardWindow): Promise<DashboardSummary> {
    const live = this.ledger.filter((entry) => entry.voidedAt === null);
    const inRange = (date: Date, from: Date, to: Date) => date >= from && date < to;

    const balances = new Map<string, number>();
    for (const entry of live) {
      const signed = entry.kind === 'cargo' ? entry.amount : -entry.amount;
      balances.set(entry.patientId, (balances.get(entry.patientId) ?? 0) + signed);
    }

    const outstanding = [...balances.values()].reduce((total, value) => total + value, 0);

    const collections = (from: Date, to: Date): MethodTotal[] =>
      METHODS.map((method) => ({
        method,
        total: live
          .filter(
            (entry) =>
              entry.kind === 'abono' &&
              entry.method === method &&
              inRange(entry.createdAt, from, to),
          )
          .reduce((total, entry) => total + entry.amount, 0),
      }));

    const debtors = [...balances.entries()]
      .filter(([, balance]) => balance > 0)
      .map(([patientId, balance]) => ({
        patientId,
        patientName: this.patients.find((patient) => patient.id === patientId)?.name ?? patientId,
        balance,
      }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5);

    const visibleQuotes = this.quotes.filter((quote) => quote.deletedAt === null);
    const funnel: Record<QuoteStatusKey, number> = {
      borrador: 0,
      sin_respuesta: 0,
      aprobada: 0,
      rechazada: 0,
    };
    for (const quote of visibleQuotes) {
      funnel[quote.status] += 1;
    }

    const decided = visibleQuotes.filter(
      (quote) =>
        quote.sanctionedAt !== null &&
        inRange(quote.sanctionedAt, window.monthStart, window.nextMonthStart) &&
        (quote.status === 'aprobada' || quote.status === 'rechazada'),
    );
    const approved = decided.filter((quote) => quote.status === 'aprobada');

    const monthAppointments = this.appointments.filter((appointment) =>
      inRange(appointment.startsAt, window.monthStart, window.nextMonthStart),
    );
    const todayAppointments = this.appointments.filter((appointment) =>
      inRange(appointment.startsAt, window.today, window.tomorrow),
    );

    const todayByStatus = new Map<string, number>();
    for (const appointment of todayAppointments) {
      todayByStatus.set(appointment.status, (todayByStatus.get(appointment.status) ?? 0) + 1);
    }

    return {
      window: { today: window.today, monthStart: window.monthStart },
      patients: {
        total: this.patients.length,
        newLast30Days: this.patients.filter(
          (patient) => patient.createdAt >= window.thirtyDaysAgo,
        ).length,
        prevision: PREVISION.map((tipo) => ({
          tipo,
          count: this.patients.filter((patient) => (patient.previsionTipo ?? 'PARTICULAR') === tipo)
            .length,
        })),
      },
      cash: {
        outstanding,
        chargesMonth: live
          .filter(
            (entry) =>
              entry.kind === 'cargo' && inRange(entry.createdAt, window.monthStart, window.nextMonthStart),
          )
          .reduce((total, entry) => total + entry.amount, 0),
        collectionsToday: collections(window.today, window.tomorrow),
        collectionsMonth: collections(window.monthStart, window.nextMonthStart),
        topDebtors: debtors,
      },
      quotes: {
        funnel,
        approvedMonth: approved.reduce((total, quote) => total + quote.approvedTotal, 0),
        conversionRate: decided.length === 0 ? null : approved.length / decided.length,
        expiringSoon: visibleQuotes.filter(
          (quote) =>
            quote.status === 'sin_respuesta' &&
            quote.validUntil !== null &&
            quote.validUntil >= window.today &&
            quote.validUntil <= window.inSevenDays,
        ).length,
      },
      agenda: {
        today: [...todayByStatus.entries()].map(([status, count]) => ({ status, count })),
        cancelledMonth: monthAppointments.filter((appointment) => appointment.status === 'cancelled')
          .length,
        totalMonth: monthAppointments.length,
        next: this.appointments
          .filter(
            (appointment) =>
              appointment.status === 'scheduled' && appointment.startsAt >= window.today,
          )
          .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
          .slice(0, 5)
          .map((appointment) => ({
            id: appointment.id,
            startsAt: appointment.startsAt,
            patientName: appointment.patientName,
            professionalName: appointment.professionalName,
            reason: appointment.reason,
          })),
      },
      recentActivity: this.activity
        .slice()
        .sort((a, b) => b.at.getTime() - a.at.getTime())
        .slice(0, 8),
    };
  }
}

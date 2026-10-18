import { Injectable } from '@nestjs/common';
import { PostgresDatabase } from '../../../../../shared/infrastructure/database/postgres-database.js';
import type { PaymentMethod } from '../../../../payments/domain/payment-method.js';
import type {
  DashboardSummary,
  DashboardWindow,
  MethodTotal,
  PrevisionCount,
  PrevisionTipo,
  QuoteStatusKey,
} from '../../../domain/dashboard-summary.js';
import { DashboardQueryPort } from '../../../application/ports/dashboard-query.port.js';

interface CountRow {
  total: number;
}

interface GroupCountRow {
  key: string;
  count: number;
}

interface MethodRow {
  method: string;
  total: number;
}

interface DebtorRow {
  id: string;
  name: string;
  balance: number;
}

interface AppointmentRow {
  id: string;
  starts_at: Date;
  patient_name: string;
  professional_name: string | null;
  reason: string | null;
}

interface ActivityRow {
  at: Date;
  actor_label: string | null;
  action: string;
  module: string;
  subject_label: string | null;
  outcome: string;
}

const QUOTE_STATUSES: QuoteStatusKey[] = ['borrador', 'sin_respuesta', 'aprobada', 'rechazada'];
const PAYMENT_METHODS: PaymentMethod[] = ['efectivo', 'tarjeta', 'transferencia'];
const PREVISION_TIPOS: PrevisionTipo[] = ['FONASA', 'ISAPRE', 'CONVENIO', 'PARTICULAR'];

/**
 * PostgreSQL read model: one aggregate query per dashboard block, all bounded by
 * the same `DashboardWindow`. Moves only voided_at IS NULL rows, matching the
 * ledger semantics (annulled movements stop counting) and excludes trashed
 * quotes (deleted_at).
 */
@Injectable()
export class PostgresDashboardQuery implements DashboardQueryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async getSummary(window: DashboardWindow): Promise<DashboardSummary> {
    const [
      patientsTotal,
      newPatients,
      previsionRows,
      outstanding,
      collectionsToday,
      collectionsMonth,
      chargesMonth,
      debtors,
      funnelRows,
      approvedMonth,
      decidedRows,
      expiringSoon,
      agendaTodayRows,
      agendaMonthRows,
      nextAppointments,
      activity,
    ] = await Promise.all([
      this.db.queryOne<CountRow>('SELECT COUNT(*)::int AS total FROM patients'),
      this.db.queryOne<CountRow>(
        'SELECT COUNT(*)::int AS total FROM patients WHERE created_at >= $1',
        [window.thirtyDaysAgo],
      ),
      this.db.query<GroupCountRow>(
        `SELECT COALESCE(UPPER(prevision_tipo), 'PARTICULAR') AS key, COUNT(*)::int AS count
           FROM patients
          GROUP BY 1`,
      ),
      this.db.queryOne<CountRow>(
        `SELECT COALESCE(SUM(CASE WHEN kind = 'cargo' THEN amount ELSE -amount END), 0)::int AS total
           FROM ledger_entries
          WHERE voided_at IS NULL`,
      ),
      this.collections(window.today, window.tomorrow),
      this.collections(window.monthStart, window.nextMonthStart),
      this.db.queryOne<CountRow>(
        `SELECT COALESCE(SUM(amount), 0)::int AS total
           FROM ledger_entries
          WHERE voided_at IS NULL AND kind = 'cargo' AND created_at >= $1 AND created_at < $2`,
        [window.monthStart, window.nextMonthStart],
      ),
      this.db.query<DebtorRow>(
        `SELECT p.id,
                p.nombres || ' ' || p.apellido_paterno || ' ' || p.apellido_materno AS name,
                SUM(CASE WHEN l.kind = 'cargo' THEN l.amount ELSE -l.amount END)::int AS balance
           FROM ledger_entries l
           JOIN patients p ON p.id = l.patient_id
          WHERE l.voided_at IS NULL
          GROUP BY p.id, name
         HAVING SUM(CASE WHEN l.kind = 'cargo' THEN l.amount ELSE -l.amount END) > 0
          ORDER BY balance DESC
          LIMIT 5`,
      ),
      this.db.query<GroupCountRow>(
        `SELECT status AS key, COUNT(*)::int AS count
           FROM quotes
          WHERE deleted_at IS NULL
          GROUP BY status`,
      ),
      this.db.queryOne<CountRow>(
        `SELECT COALESCE(SUM(qi.net_amount), 0)::int AS total
           FROM quote_items qi
           JOIN quotes q ON q.id = qi.quote_id
          WHERE q.deleted_at IS NULL
            AND q.status = 'aprobada'
            AND q.sanctioned_at >= $1 AND q.sanctioned_at < $2
            AND qi.status = 'aprobado'`,
        [window.monthStart, window.nextMonthStart],
      ),
      this.db.query<GroupCountRow>(
        `SELECT status AS key, COUNT(*)::int AS count
           FROM quotes
          WHERE deleted_at IS NULL
            AND sanctioned_at >= $1 AND sanctioned_at < $2
            AND status IN ('aprobada', 'rechazada')
          GROUP BY status`,
        [window.monthStart, window.nextMonthStart],
      ),
      this.db.queryOne<CountRow>(
        `SELECT COUNT(*)::int AS total
           FROM quotes
          WHERE deleted_at IS NULL
            AND status = 'sin_respuesta'
            AND valid_until IS NOT NULL
            AND valid_until >= $1 AND valid_until <= $2`,
        [window.today, window.inSevenDays],
      ),
      this.db.query<GroupCountRow>(
        `SELECT status AS key, COUNT(*)::int AS count
           FROM appointments
          WHERE starts_at >= $1 AND starts_at < $2
          GROUP BY status`,
        [window.today, window.tomorrow],
      ),
      this.db.query<GroupCountRow>(
        `SELECT status AS key, COUNT(*)::int AS count
           FROM appointments
          WHERE starts_at >= $1 AND starts_at < $2
          GROUP BY status`,
        [window.monthStart, window.nextMonthStart],
      ),
      this.db.query<AppointmentRow>(
        `SELECT a.id, a.starts_at,
                p.nombres || ' ' || p.apellido_paterno || ' ' || p.apellido_materno AS patient_name,
                u.name AS professional_name,
                a.reason
           FROM appointments a
           JOIN patients p ON p.id = a.patient_id
           LEFT JOIN users u ON u.id = a.professional_id
          WHERE a.status = 'scheduled' AND a.starts_at >= $1
          ORDER BY a.starts_at ASC
          LIMIT 5`,
        [window.today],
      ),
      this.db.query<ActivityRow>(
        `SELECT at, actor_label, action, module, subject_label, outcome
           FROM activity_log
          ORDER BY at DESC
          LIMIT 8`,
      ),
    ]);

    const funnel = this.emptyFunnel();
    for (const row of funnelRows) {
      if (QUOTE_STATUSES.includes(row.key as QuoteStatusKey)) {
        funnel[row.key as QuoteStatusKey] = row.count;
      }
    }

    const decided = new Map(decidedRows.map((row) => [row.key, row.count]));
    const approved = decided.get('aprobada') ?? 0;
    const rejected = decided.get('rechazada') ?? 0;
    const decidedTotal = approved + rejected;

    const monthByStatus = new Map(agendaMonthRows.map((row) => [row.key, row.count]));
    const agendaTotalMonth = agendaMonthRows.reduce((total, row) => total + row.count, 0);

    return {
      window: { today: window.today, monthStart: window.monthStart },
      patients: {
        total: patientsTotal?.total ?? 0,
        newLast30Days: newPatients?.total ?? 0,
        prevision: this.normalizePrevision(previsionRows),
      },
      cash: {
        outstanding: outstanding?.total ?? 0,
        chargesMonth: chargesMonth?.total ?? 0,
        collectionsToday: collectionsToday,
        collectionsMonth,
        topDebtors: debtors.map((row) => ({
          patientId: row.id,
          patientName: row.name,
          balance: row.balance,
        })),
      },
      quotes: {
        funnel,
        approvedMonth: approvedMonth?.total ?? 0,
        conversionRate: decidedTotal === 0 ? null : approved / decidedTotal,
        expiringSoon: expiringSoon?.total ?? 0,
      },
      agenda: {
        today: agendaTodayRows.map((row) => ({ status: row.key, count: row.count })),
        cancelledMonth: monthByStatus.get('cancelled') ?? 0,
        totalMonth: agendaTotalMonth,
        next: nextAppointments.map((row) => ({
          id: row.id,
          startsAt: row.starts_at,
          patientName: row.patient_name,
          professionalName: row.professional_name ?? '—',
          reason: row.reason,
        })),
      },
      recentActivity: activity.map((row) => ({
        at: row.at,
        actor: row.actor_label,
        action: row.action,
        module: row.module,
        subject: row.subject_label,
        outcome: row.outcome,
      })),
    };
  }

  private async collections(from: Date, to: Date): Promise<MethodTotal[]> {
    const rows = await this.db.query<MethodRow>(
      `SELECT method, COALESCE(SUM(amount), 0)::int AS total
         FROM ledger_entries
        WHERE voided_at IS NULL
          AND kind = 'abono'
          AND method IS NOT NULL
          AND created_at >= $1 AND created_at < $2
        GROUP BY method`,
      [from, to],
    );

    const totals = new Map(rows.map((row) => [row.method, row.total]));

    return PAYMENT_METHODS.map((method) => ({ method, total: totals.get(method) ?? 0 }));
  }

  private emptyFunnel(): Record<QuoteStatusKey, number> {
    return { borrador: 0, sin_respuesta: 0, aprobada: 0, rechazada: 0 };
  }

  private normalizePrevision(rows: GroupCountRow[]): PrevisionCount[] {
    const counts = new Map(rows.map((row) => [row.key, row.count]));

    return PREVISION_TIPOS.map((tipo) => ({ tipo, count: counts.get(tipo) ?? 0 }));
  }
}

import { InMemoryDashboardQuery } from '../../infrastructure/adapters/persistence/in-memory-dashboard.query.js';
import { GetDashboardSummaryUseCase } from './get-dashboard-summary.use-case.js';

describe('GetDashboardSummaryUseCase', () => {
  // Local-time reference so the assertions do not depend on the machine's TZ.
  const now = new Date(2026, 9, 18, 12, 0, 0); // 2026-10-18 12:00 local
  const at = (day: number, hour = 10) => new Date(2026, 9, day, hour, 0, 0);

  const setup = () => {
    const query = new InMemoryDashboardQuery({
      patients: [
        {
          id: 'p-1',
          name: 'Camila Rojas',
          createdAt: at(16),
          previsionTipo: 'FONASA',
        },
        {
          id: 'p-2',
          name: 'Diego Soto',
          createdAt: new Date(2026, 6, 1),
          previsionTipo: null,
        },
      ],
      ledger: [
        // p-1: 13.000 cargo, 3.000 abono, a 5.000 voided cargo → balance 10.000.
        { patientId: 'p-1', kind: 'cargo', amount: 13000, method: null, createdAt: at(18), voidedAt: null },
        { patientId: 'p-1', kind: 'abono', amount: 3000, method: 'efectivo', createdAt: at(18), voidedAt: null },
        { patientId: 'p-1', kind: 'cargo', amount: 5000, method: null, createdAt: at(18), voidedAt: at(18) },
        // p-2: 4.000 cargo → balance 4.000.
        { patientId: 'p-2', kind: 'cargo', amount: 4000, method: null, createdAt: at(5), voidedAt: null },
      ],
      quotes: [
        {
          id: 'q-1',
          status: 'aprobada',
          sanctionedAt: at(10),
          validUntil: at(25),
          deletedAt: null,
          approvedTotal: 13000,
        },
        {
          id: 'q-2',
          status: 'rechazada',
          sanctionedAt: at(11),
          validUntil: at(25),
          deletedAt: null,
          approvedTotal: 0,
        },
        {
          id: 'q-3',
          status: 'sin_respuesta',
          sanctionedAt: null,
          validUntil: at(20),
          deletedAt: null,
          approvedTotal: 0,
        },
        {
          id: 'q-4',
          status: 'borrador',
          sanctionedAt: null,
          validUntil: null,
          deletedAt: null,
          approvedTotal: 0,
        },
        {
          id: 'q-5',
          status: 'aprobada',
          sanctionedAt: at(10),
          validUntil: null,
          deletedAt: at(12),
          approvedTotal: 99999,
        },
      ],
      appointments: [
        {
          id: 'a-1',
          startsAt: at(18, 9),
          status: 'scheduled',
          patientName: 'Camila Rojas',
          professionalName: 'Dr. Pérez',
          reason: 'Control',
        },
        {
          id: 'a-2',
          startsAt: at(18, 15),
          status: 'cancelled',
          patientName: 'Diego Soto',
          professionalName: 'Dr. Pérez',
          reason: null,
        },
        {
          id: 'a-3',
          startsAt: at(21, 11),
          status: 'scheduled',
          patientName: 'Camila Rojas',
          professionalName: 'Dra. Díaz',
          reason: 'Endodoncia',
        },
      ],
      activity: [
        {
          at: at(18, 11),
          actor: 'Administrator',
          action: 'payments.payment.record',
          module: 'payments',
          subject: 'Camila Rojas',
          outcome: 'success',
        },
      ],
    });

    return { useCase: new GetDashboardSummaryUseCase(query) };
  };

  it('shares one day/month window across every block', async () => {
    const { useCase } = setup();

    const summary = await useCase.execute({ now });

    expect(summary.window.today).toEqual(new Date(2026, 9, 18));
    expect(summary.window.monthStart).toEqual(new Date(2026, 9, 1));
  });

  it('aggregates patients: total, recent and prevision mix', async () => {
    const { useCase } = setup();

    const summary = await useCase.execute({ now });

    expect(summary.patients.total).toBe(2);
    expect(summary.patients.newLast30Days).toBe(1);
    expect(summary.patients.prevision).toEqual([
      { tipo: 'FONASA', count: 1 },
      { tipo: 'ISAPRE', count: 0 },
      { tipo: 'CONVENIO', count: 0 },
      { tipo: 'PARTICULAR', count: 1 },
    ]);
  });

  it('computes the balance and collections ignoring voided movements', async () => {
    const { useCase } = setup();

    const summary = await useCase.execute({ now });

    expect(summary.cash.outstanding).toBe(14000);
    expect(summary.cash.chargesMonth).toBe(17000);
    expect(summary.cash.collectionsToday).toEqual([
      { method: 'efectivo', total: 3000 },
      { method: 'tarjeta', total: 0 },
      { method: 'transferencia', total: 0 },
    ]);
    expect(summary.cash.topDebtors).toEqual([
      { patientId: 'p-1', patientName: 'Camila Rojas', balance: 10000 },
      { patientId: 'p-2', patientName: 'Diego Soto', balance: 4000 },
    ]);
  });

  it('computes the quote funnel, approved month, conversion and expiring soon', async () => {
    const { useCase } = setup();

    const summary = await useCase.execute({ now });

    expect(summary.quotes.funnel).toEqual({
      borrador: 1,
      sin_respuesta: 1,
      aprobada: 1,
      rechazada: 1,
    });
    // The trashed quote is excluded from the money.
    expect(summary.quotes.approvedMonth).toBe(13000);
    expect(summary.quotes.conversionRate).toBe(0.5);
    // q-3 expires on Oct 20 (within today + 7 days).
    expect(summary.quotes.expiringSoon).toBe(1);
  });

  it('summarizes today agenda, month cancellations and the next appointments', async () => {
    const { useCase } = setup();

    const summary = await useCase.execute({ now });

    expect(summary.agenda.today).toEqual([
      { status: 'scheduled', count: 1 },
      { status: 'cancelled', count: 1 },
    ]);
    expect(summary.agenda.totalMonth).toBe(3);
    expect(summary.agenda.cancelledMonth).toBe(1);
    expect(summary.agenda.next.map((appointment) => appointment.id)).toEqual(['a-1', 'a-3']);
  });

  it('returns the latest activity events, newest first', async () => {
    const { useCase } = setup();

    const summary = await useCase.execute({ now });

    expect(summary.recentActivity).toHaveLength(1);
    expect(summary.recentActivity[0]!.action).toBe('payments.payment.record');
  });
});
